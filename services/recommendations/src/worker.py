import signal
from types import FrameType

from src.config import settings
from src.consumers.product_changed_consumer import (
    shutdown_sqs_client,
    start_product_changed_consumer,
)
from src.db import Base, engine

_running = True


def _handle_shutdown(signum: int, frame: FrameType | None) -> None:
    global _running
    print("[recommendations-worker] received shutdown signal, stopping...")
    _running = False


def _should_continue() -> bool:
    return _running


signal.signal(signal.SIGINT, _handle_shutdown)
signal.signal(signal.SIGTERM, _handle_shutdown)

# Same create_all() main.py's lifespan hook runs — without this, starting
# the worker before the HTTP server has ever run means every message fails
# against a missing table (caught, left for redelivery, eventually DLQ'd)
# until something else happens to create it. Idempotent either way.
Base.metadata.create_all(bind=engine)

print(f"[recommendations-worker] started (env: {settings.environment})")
start_product_changed_consumer(_should_continue)
shutdown_sqs_client()
print("[recommendations-worker] shutdown complete")
