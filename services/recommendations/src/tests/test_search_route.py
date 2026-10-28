from unittest.mock import AsyncMock

from fastapi.testclient import TestClient

from src.clients.products_client import ProductResponse, ProductsUnavailableError
from src.main import app
from src.models import ProductEmbedding
from src.services import search_service
from src.services.search_service import upsert_product_embedding

client = TestClient(app)


def test_health_returns_ok():
    res = client.get("/health")
    assert res.status_code == 200
    assert res.json() == {"status": "ok"}


def test_search_returns_a_recommendation_over_real_http(db_session, monkeypatch):
    upsert_product_embedding(db_session, "prod-http-1", "noise-cancelling wireless headphones")

    fake_product = ProductResponse(
        id="prod-http-1",
        name="QuietMax Headphones",
        description="Wireless, noise-cancelling, all-day battery",
        price="149.99",
        sku="HEAD-1",
        stock=5,
    )
    monkeypatch.setattr(
        search_service, "get_product_by_id", AsyncMock(return_value=fake_product)
    )
    monkeypatch.setattr(
        search_service,
        "generate_answer",
        AsyncMock(return_value="These headphones match what you're looking for."),
    )

    try:
        res = client.post("/search", json={"query": "headphones that block out noise"})

        assert res.status_code == 200
        body = res.json()
        assert body["answer"] == "These headphones match what you're looking for."
        assert len(body["products"]) == 1
        assert body["products"][0]["product_id"] == "prod-http-1"
        assert body["products"][0]["name"] == "QuietMax Headphones"
    finally:
        db_session.query(ProductEmbedding).filter_by(product_id="prod-http-1").delete()
        db_session.commit()


def test_search_returns_503_when_products_is_unreachable(db_session, monkeypatch):
    # Regression: this used to be a 500. The embedding search succeeds (pure
    # pgvector, no dependency on products), then the live enrichment call to
    # products throws — that's a downstream outage, not a server bug here.
    upsert_product_embedding(db_session, "prod-http-503", "noise-cancelling wireless headphones")

    monkeypatch.setattr(
        search_service,
        "get_product_by_id",
        AsyncMock(
            side_effect=ProductsUnavailableError(
                "Could not reach products service at http://localhost:4002: "
                "All connection attempts failed"
            )
        ),
    )
    generate_answer_mock = AsyncMock()
    monkeypatch.setattr(search_service, "generate_answer", generate_answer_mock)

    try:
        res = client.post("/search", json={"query": "headphones that block out noise"})

        assert res.status_code == 503
        assert "Could not reach products service" in res.json()["detail"]
        # Never reached the LLM — no point paying for a summary of nothing.
        generate_answer_mock.assert_not_awaited()
    finally:
        db_session.query(ProductEmbedding).filter_by(product_id="prod-http-503").delete()
        db_session.commit()
