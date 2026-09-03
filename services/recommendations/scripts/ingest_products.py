"""Backfill/recovery tool, not the primary ingestion path anymore — that's
now the product_changed consumer (worker.py), which updates embeddings in
real time as products are created/updated/deleted. Use this script to seed
product_embeddings from an existing catalog (e.g. first deploy), or to
recover from drift if the consumer was down or a message hit the DLQ.

Fetches every product from the products service, embeds name +
description, and upserts into product_embeddings.

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
