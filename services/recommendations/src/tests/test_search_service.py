from unittest.mock import AsyncMock

import pytest

from src.clients.products_client import ProductResponse
from src.models import ProductEmbedding
from src.services import search_service
from src.services.search_service import search, upsert_product_embedding


@pytest.fixture
def seeded_product(db_session):
    row = upsert_product_embedding(
        db_session, "prod-1", "running shoes for jogging and light trail use"
    )
    yield row
    db_session.query(ProductEmbedding).filter_by(product_id="prod-1").delete()
    db_session.commit()


def test_upsert_product_embedding_persists_the_source_text_as_content(db_session):
    row = upsert_product_embedding(db_session, "prod-content-1", "a cozy wool sweater")
    try:
        assert row.content == "a cozy wool sweater"

        updated = upsert_product_embedding(db_session, "prod-content-1", "a warm wool sweater")
        assert updated.id == row.id  # same row, updated in place
        assert updated.content == "a warm wool sweater"
    finally:
        db_session.query(ProductEmbedding).filter_by(product_id="prod-content-1").delete()
        db_session.commit()


async def test_search_returns_llm_generated_answer_and_scored_matches(seeded_product, monkeypatch):
    fake_product = ProductResponse(
        id="prod-1",
        name="Trail Runner Shoes",
        description="Lightweight shoes built for jogging",
        price="59.99",
        sku="SHOE-1",
        stock=10,
    )
    get_product_mock = AsyncMock(return_value=fake_product)
    generate_answer_mock = AsyncMock(return_value="These shoes are a great match for jogging.")
    monkeypatch.setattr(search_service, "get_product_by_id", get_product_mock)
    monkeypatch.setattr(search_service, "generate_answer", generate_answer_mock)

    result = await search("shoes for running")

    assert result.answer == "These shoes are a great match for jogging."
    assert len(result.products) == 1
    assert result.products[0].product_id == "prod-1"
    assert result.products[0].name == "Trail Runner Shoes"
    assert isinstance(result.products[0].score, float)
    get_product_mock.assert_called_once_with("prod-1")
    generate_answer_mock.assert_called_once()


async def test_search_returns_matches_with_degraded_answer_when_the_llm_client_reports_failure(
    seeded_product, monkeypatch
):
    fake_product = ProductResponse(
        id="prod-1",
        name="Trail Runner Shoes",
        description="Lightweight shoes built for jogging",
        price="59.99",
        sku="SHOE-1",
        stock=10,
    )
    # generate_answer's own contract (see test_llm_client.py) is to never
    # raise — on an LLM failure it returns this fallback string instead of
    # propagating. This confirms search() still returns the real matches
    # rather than treating a degraded answer as a request-level failure.
    degraded_answer = "Here are the closest matching products, though I couldn't generate a summary right now."
    monkeypatch.setattr(search_service, "get_product_by_id", AsyncMock(return_value=fake_product))
    monkeypatch.setattr(search_service, "generate_answer", AsyncMock(return_value=degraded_answer))

    result = await search("shoes for running")

    assert result.answer == degraded_answer
    assert len(result.products) == 1
    assert result.products[0].product_id == "prod-1"


async def test_search_returns_no_matches_without_calling_the_llm(seeded_product, monkeypatch):
    get_product_mock = AsyncMock(return_value=None)  # product deleted/404 upstream
    generate_answer_mock = AsyncMock()
    monkeypatch.setattr(search_service, "get_product_by_id", get_product_mock)
    monkeypatch.setattr(search_service, "generate_answer", generate_answer_mock)

    result = await search("shoes for running")

    assert result.products == []
    assert result.answer == "No matching products found."
    generate_answer_mock.assert_not_called()
