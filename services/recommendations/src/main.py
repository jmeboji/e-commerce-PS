from contextlib import asynccontextmanager

from fastapi import FastAPI

from src.config import settings
from src.db import Base, engine
from src.routes.search import router as search_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    # No migration framework for this service yet — create_all is idempotent
    # and sufficient until the schema needs real migration history (Prisma
    # Migrate plays this role in the Node services).
    Base.metadata.create_all(bind=engine)
    yield


app = FastAPI(lifespan=lifespan)


@app.get("/health")
async def health():
    return {"status": "ok"}


app.include_router(search_router)


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("src.main:app", host="0.0.0.0", port=settings.port, reload=True)
