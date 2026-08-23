from pydantic import BaseModel


class SalesPoint(BaseModel):
    period: str  # "2026-08-01" (daily) or "2026-08" (monthly), restaurant-local
    online: float
    restaurant: float
    total: float


class SalesTotals(BaseModel):
    online: float
    restaurant: float
    total: float


class SalesSeries(BaseModel):
    granularity: str  # "day" | "month"
    points: list[SalesPoint]
    totals: SalesTotals


class ClientsPoint(BaseModel):
    period: str
    from_app: int
    total: int


class ClientsTotals(BaseModel):
    from_app: int
    total: int


class ClientsSeries(BaseModel):
    granularity: str
    points: list[ClientsPoint]
    totals: ClientsTotals


class CategoryShare(BaseModel):
    category_id: int
    name: str
    revenue: float
    percent: float


class ProductShare(BaseModel):
    product_id: int
    name: str
    revenue: float
    percent: float


class CategoryProducts(BaseModel):
    category_id: int
    name: str
    revenue: float
    products: list[ProductShare]
