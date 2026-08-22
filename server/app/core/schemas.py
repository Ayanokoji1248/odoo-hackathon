from typing import Generic, TypeVar

from pydantic import BaseModel

T = TypeVar("T")


class PageMeta(BaseModel):
    page: int
    limit: int
    total: int


class ApiResponse(BaseModel, Generic[T]):
    """Success envelope. Used as `response_model` so OpenAPI shows the real shape."""

    success: bool = True
    data: T
    meta: PageMeta | None = None


class ErrorDetail(BaseModel):
    field: str
    message: str


class ErrorBody(BaseModel):
    code: str
    message: str
    details: list[ErrorDetail] | None = None


class ErrorResponse(BaseModel):
    success: bool = False
    error: ErrorBody
