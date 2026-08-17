"""One-off manual ingestion: fetch every product from the products service,
embed name + description, and upsert into product_embeddings.

Run from the service root: python scripts/ingest_products.py
"""

import asyncio

from src.clients.products_client import list_products
from src.db import SessionLocal
from src.services.search_service import upsert_product_embedding


async def main() -> None:
    products = await list_products()
    print(f"fetched {len(products)} product(s) from products service")

    db = SessionLocal()
    try:
        for product in products:
            text = f"{product.name} {product.description}"
            upsert_product_embedding(db, product.id, text)
            print(f"  embedded {product.id}: {product.name}")
    finally:
        db.close()

    print(f"done — {len(products)} product(s) ingested")


if __name__ == "__main__":
    asyncio.run(main())
