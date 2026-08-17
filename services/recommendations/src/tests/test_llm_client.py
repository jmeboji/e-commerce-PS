from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from src.clients.llm_client import generate_answer
from src.schemas import RecommendedProduct


def fake_products() -> list[RecommendedProduct]:
    return [
        RecommendedProduct(
            product_id="fake-1",
            name="QuietMax Headphones",
            description="Wireless noise-cancelling headphones with all-day battery",
            price="149.99",
            score=0.12,
        ),
    ]


@pytest.mark.asyncio
async def test_generate_answer_returns_llm_text_on_success():
    mock_response = MagicMock()
    mock_response.content = [MagicMock(text="These headphones would be perfect for your needs.")]

    with patch(
        "src.clients.llm_client._client.messages.create",
        new=AsyncMock(return_value=mock_response),
    ):
        answer = await generate_answer("bluetooth audio gear", fake_products())

    assert answer == "These headphones would be perfect for your needs."


@pytest.mark.asyncio
async def test_generate_answer_degrades_gracefully_on_failure(caplog):
    with patch(
        "src.clients.llm_client._client.messages.create",
        new=AsyncMock(side_effect=Exception("simulated API failure")),
    ):
        with caplog.at_level("ERROR"):
            answer = await generate_answer("bluetooth audio gear", fake_products())

    assert answer == "Here are the closest matching products, though I couldn't generate a summary right now."
    assert "LLM generation failed" in caplog.text
