from pydantic import BaseModel


class RestaurantOut(BaseModel):
    id: int
    slug: str
    name: str

    class Config:
        from_attributes = True
