from fastapi import APIRouter

from src.schemas import SearchRequest, SearchResult
from src.services.search_service import search as run_search

router = APIRouter()


@router.post("/search", response_model=SearchResult)
async def search(request: SearchRequest):
    return await run_search(request.query)
