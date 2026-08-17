import uuid
from datetime import datetime, timezone

from pgvector.sqlalchemy import Vector
from sqlalchemy import DateTime, String
from sqlalchemy.orm import Mapped, mapped_column

from src.db import Base

# Must match the output dimensionality of the model hardcoded in
# embedding_service.py (all-MiniLM-L6-v2 -> 384). Changing the model
# requires re-embedding every row, since vectors from different models
# aren't comparable.
EMBEDDING_DIM = 384


class ProductEmbedding(Base):
    __tablename__ = "product_embeddings"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    product_id: Mapped[str] = mapped_column(String, unique=True, index=True)
    content: Mapped[str] = mapped_column(String)  # the text that was embedded — name + description, kept for debugging/re-embedding
    embedding: Mapped[Vector] = mapped_column(Vector(EMBEDDING_DIM))  # 384 = all-MiniLM-L6-v2's output dimension
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )
