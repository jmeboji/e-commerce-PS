import logging

from anthropic import AsyncAnthropic

from src.config import settings
from src.schemas import RecommendedProduct

logger = logging.getLogger(__name__)

_client = AsyncAnthropic(api_key=settings.anthropic_api_key)


async def generate_answer(query: str, products: list[RecommendedProduct]) -> str:
    product_lines = "\n".join(
        f"- {p.name} (${p.price}): {p.description}" for p in products
    )
    try:
        response = await _client.messages.create(
            model=settings.llm_model,
            max_tokens=300,
            messages=[
                {
                    "role": "user",
                    "content": (
                        f'A shopper asked: "{query}"\n\n'
                        f"Here are the most relevant products found via similarity search:\n{product_lines}\n\n"
                        "Write a short, friendly recommendation (2-3 sentences) explaining why these "
                        "products fit what they're looking for."
                    ),
                }
            ],
        )
        return response.content[0].text
    except Exception as e:
        logger.error(f"LLM generation failed for query '{query}': {e}")
        return "Here are the closest matching products, though I couldn't generate a summary right now."
