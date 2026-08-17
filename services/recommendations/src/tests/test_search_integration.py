from unittest.mock import AsyncMock

from src.clients.products_client import ProductResponse
from src.models import ProductEmbedding
from src.services import search_service
from src.services.search_service import search, upsert_product_embedding

HEADPHONES_ID = "integration-headphones"
GARDEN_HOSE_ID = "integration-garden-hose"


def _fake_product(product_id: str, name: str, description: str) -> ProductResponse:
    return ProductResponse(
        id=product_id, name=name, description=description, price="19.99", sku=product_id, stock=1
    )


async def test_search_ranks_the_semantically_relevant_product_first(db_session, monkeypatch):
    # Real Postgres + pgvector + the real embedding model end to end. Only
    # the cross-service product fetch and the LLM synthesis are mocked —
    # this test's job is proving retrieval/ranking is actually correct, not
    # re-proving the products-service HTTP boundary (already verified live)
    # or the LLM call itself (covered in test_llm_client.py).
    upsert_product_embedding(
        db_session, HEADPHONES_ID, "Wireless bluetooth headphones with noise cancellation"
    )
    upsert_product_embedding(
        db_session, GARDEN_HOSE_ID, "50ft expandable garden hose for watering the lawn"
    )

    products_by_id = {
        HEADPHONES_ID: _fake_product(
            HEADPHONES_ID, "SoundWave Headphones", "Wireless bluetooth headphones with noise cancellation"
        ),
        GARDEN_HOSE_ID: _fake_product(
            GARDEN_HOSE_ID, "FlexReach Hose", "50ft expandable garden hose for watering the lawn"
        ),
    }

    async def fake_get_product_by_id(product_id: str):
        return products_by_id.get(product_id)

    monkeypatch.setattr(search_service, "get_product_by_id", fake_get_product_by_id)
    monkeypatch.setattr(search_service, "generate_answer", AsyncMock(return_value="stub"))

    try:
        result = await search("bluetooth audio", top_k=2)

        assert len(result.products) == 2
        assert result.products[0].product_id == HEADPHONES_ID
        assert result.products[1].product_id == GARDEN_HOSE_ID
        assert result.products[0].score < result.products[1].score  # lower cosine distance = more similar
    finally:
        db_session.query(ProductEmbedding).filter(
            ProductEmbedding.product_id.in_([HEADPHONES_ID, GARDEN_HOSE_ID])
        ).delete(synchronize_session=False)
        db_session.commit()
