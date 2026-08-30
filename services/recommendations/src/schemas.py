from typing import Annotated, Any, Literal, Union

from pydantic import BaseModel, ConfigDict, Field, TypeAdapter


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


# Shared wire contract with products (TypeScript) over the product_changed
# SNS topic — name/description only matter for created/updated, since
# that's what gets embedded; deleted only carries enough to remove the row
# (existing productId). Mirrors products/src/schemas/product.schema.ts's
# discriminated union field-for-field.
class ProductCreatedEvent(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    event_type: Literal["created"] = Field(alias="eventType")
    product_id: str = Field(alias="productId")
    name: str
    description: str


class ProductUpdatedEvent(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    event_type: Literal["updated"] = Field(alias="eventType")
    product_id: str = Field(alias="productId")
    name: str
    description: str


class ProductDeletedEvent(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    event_type: Literal["deleted"] = Field(alias="eventType")
    product_id: str = Field(alias="productId")


ProductChangedEvent = Annotated[
    Union[ProductCreatedEvent, ProductUpdatedEvent, ProductDeletedEvent],
    Field(discriminator="event_type"),
]

# Union type aliases aren't BaseModels, so validation goes through a
# TypeAdapter rather than ProductChangedEvent.model_validate(...).
_product_changed_event_adapter = TypeAdapter(ProductChangedEvent)


def parse_product_changed_event(data: dict[str, Any]) -> ProductChangedEvent:
    return _product_changed_event_adapter.validate_python(data)
