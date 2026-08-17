from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.orm import Session

from src.clients.llm_client import generate_answer
from src.clients.products_client import get_product_by_id
from src.db import SessionLocal
from src.models import ProductEmbedding
from src.schemas import RecommendedProduct, SearchResult
from src.services.embedding_service import embed


# pgvector cosine-similarity search via SQLAlchemy. Opens and closes its own
# session — search() no longer threads one through from the route, so this
# is self-contained the same way the HTTP clients manage their own client
# per call, rather than a request-scoped session injected via FastAPI.
async def get_similar_products(query_embedding: list[float], top_k: int) -> list[RecommendedProduct]:
    distance = ProductEmbedding.embedding.cosine_distance(query_embedding)
    db = SessionLocal()
    try:
        # Select the scalar product_id, not the ORM entity, so nothing here
        # depends on the row still being attached to the session below.
        rows = db.execute(
            select(ProductEmbedding.product_id, distance.label("distance"))
            .order_by(distance)
            .limit(top_k)
        ).all()
    finally:
        db.close()

    matches: list[RecommendedProduct] = []
    for product_id, dist in rows:
        product = await get_product_by_id(product_id)
        if product is not None:
            matches.append(
                RecommendedProduct(
                    product_id=product.id,
                    name=product.name,
                    description=product.description,
                    price=product.price,
                    score=float(dist),
                )
            )
    return matches


async def search(query: str, top_k: int = 5) -> SearchResult:
    query_embedding = embed(query)
    # pgvector cosine-similarity search via SQLAlchemy
    matches = await get_similar_products(query_embedding, top_k)
    if not matches:
        return SearchResult(answer="No matching products found.", products=[])
    answer = await generate_answer(query, matches)  # LLM call, given the retrieved products as context
    return SearchResult(answer=answer, products=matches)


# Used by scripts/ingest_products.py (manual ingestion) and directly by
# tests — there's still no automatic pipeline (e.g. triggered off a
# ProductCreated event), just the one-off script.
#
# INSERT ... ON CONFLICT DO UPDATE, not a SELECT-then-branch: the earlier
# version checked for an existing row, then inserted or mutated based on
# what it saw — a real TOCTOU gap, since a concurrent call for the same
# product_id could pass the same check and collide on the unique constraint.
# ON CONFLICT resolves atomically in Postgres itself, the same way
# inventory's WHERE-guarded updateMany closes its own check-then-act race.
def upsert_product_embedding(db: Session, product_id: str, text: str) -> ProductEmbedding:
    embedding = embed(text)
    now = datetime.now(timezone.utc)
    stmt = (
        pg_insert(ProductEmbedding)
        .values(product_id=product_id, content=text, embedding=embedding, updated_at=now)
        .on_conflict_do_update(
            index_elements=[ProductEmbedding.product_id],
            set_={"content": text, "embedding": embedding, "updated_at": now},
        )
        .returning(ProductEmbedding)
    )
    row = db.scalars(stmt).one()
    db.commit()
    db.refresh(row)
    return row
