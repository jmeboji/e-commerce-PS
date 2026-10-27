from fastapi import APIRouter, HTTPException

from src.clients.products_client import ProductsUnavailableError
from src.schemas import SearchRequest, SearchResult
from src.services.search_service import search as run_search

router = APIRouter()


@router.post("/search", response_model=SearchResult)
async def search(request: SearchRequest):
    try:
        return await run_search(request.query)
    except ProductsUnavailableError as e:
        # 503, not 500. The embedding search itself succeeded — this is a
        # downstream dependency being down, and it's retryable. Not degraded
        # to an empty result set the way an LLM failure degrades to a
        # generic answer: name/price/description come from products and are
        # the actual payload here, so "no matches" would misreport an
        # outage as an empty catalog.
        raise HTTPException(status_code=503, detail=str(e)) from e
