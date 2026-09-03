import os
import signal
import subprocess
import time
from pathlib import Path

import httpx
import pytest

from src.consumers.product_changed_consumer import poll_once, sqs_client
from src.models import ProductEmbedding

PRODUCTS_DIR = Path(__file__).resolve().parents[3] / "products"
PRODUCTS_PORT = 4099
PRODUCTS_URL = f"http://localhost:{PRODUCTS_PORT}"
QUEUE_URL = "http://sqs.us-east-1.localhost.localstack.cloud:4566/000000000000/local-recommendations-product-changed-queue"


def wait_for_health(url: str, timeout: float = 15.0) -> None:
    start = time.time()
    while time.time() - start < timeout:
        try:
            res = httpx.get(f"{url}/health", timeout=1.0)
            if res.status_code == 200:
                return
        except httpx.RequestError:
            pass
        time.sleep(0.2)
    raise TimeoutError(f"products service did not become healthy within {timeout}s")


def _resolve_node22_bin_dir() -> str | None:
    # Best-effort: this repo's .nvmrc pins Node 22, but the shell's default
    # active Node here is 20.11.1 — one patch version below products'
    # engines (>=20.12.0), and the AWS SDK v3 already warns it'll hard-
    # require Node >=22 from January 2027. Works under 20.11.1 today (just a
    # warning), but pin it anyway rather than depending on whatever Node
    # happens to be active in whichever shell eventually runs pytest.
    # Falls back to the inherited PATH if nvm isn't found.
    try:
        result = subprocess.run(
            ["bash", "-lc", "source ~/.nvm/nvm.sh && nvm which 22"],
            capture_output=True,
            text=True,
            timeout=10,
        )
        lines = [line for line in result.stdout.strip().splitlines() if line]
        node_path = lines[-1] if lines else ""
        if node_path and Path(node_path).exists():
            return str(Path(node_path).parent)
    except Exception:
        pass
    return None


@pytest.fixture(scope="module")
def products_process():
    env = os.environ.copy()
    env["PORT"] = str(PRODUCTS_PORT)
    # products has its own DATABASE_URL in its own .env — don't let this
    # process's environment leak into it, mirroring the same isolation
    # reasoning as orders' spawn of cart.
    env.pop("DATABASE_URL", None)

    node22_bin = _resolve_node22_bin_dir()
    if node22_bin:
        env["PATH"] = f"{node22_bin}:{env.get('PATH', '')}"

    proc = subprocess.Popen(
        ["pnpm", "exec", "tsx", "src/index.ts"],
        cwd=str(PRODUCTS_DIR),
        env=env,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        start_new_session=True,  # own process group, so the kill below can
        # reach the real node process pnpm exec spawns underneath it —
        # proc.kill() alone only signals the pnpm wrapper itself and
        # confirmed (empirically) to leak the actual tsx/node child.
    )
    try:
        wait_for_health(PRODUCTS_URL)
        yield proc
    finally:
        try:
            os.killpg(os.getpgid(proc.pid), signal.SIGKILL)
        except ProcessLookupError:
            pass  # already gone
        proc.wait(timeout=5)


def test_real_product_create_via_http_produces_a_real_embedding_row(products_process, db_session):
    sqs_client.purge_queue(QueueUrl=QUEUE_URL)

    payload = {
        "name": "CrossLang Test Product",
        "description": "Proves the Node publisher and Python consumer agree on the wire format",
        "price": 12.5,
        "sku": "WIDGET-XLANG-CROSSTEST",
        "stock": 2,
    }
    res = httpx.post(f"{PRODUCTS_URL}/products", json=payload, timeout=5.0)
    assert res.status_code == 201
    product_id = res.json()["id"]

    try:
        # Give LocalStack a moment to actually deliver SNS -> SQS, then
        # drive consumption directly — nothing else runs the consumer for
        # this test, matching the pattern already proven in
        # test_product_changed_integration.py rather than polling the DB
        # and hoping some other process picks the message up.
        time.sleep(0.5)
        processed = poll_once()
        assert len(processed) == 1

        db_session.expire_all()
        row = db_session.query(ProductEmbedding).filter_by(product_id=product_id).first()
        assert row is not None
        assert row.content == f"{payload['name']} {payload['description']}"
    finally:
        httpx.delete(f"{PRODUCTS_URL}/products/{product_id}", timeout=5.0)
        time.sleep(0.5)
        poll_once()

        db_session.expire_all()
        remaining = db_session.query(ProductEmbedding).filter_by(product_id=product_id).first()
        assert remaining is None
