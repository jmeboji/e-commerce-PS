from pydantic import BaseModel


class SearchRequest(BaseModel):
    query: str


class RecommendedProduct(BaseModel):
    product_id: str
    name: str
    description: str
    price: str
    score: float


class SearchResult(BaseModel):
    answer: str
    products: list[RecommendedProduct]
