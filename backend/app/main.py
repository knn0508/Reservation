from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import (
    admin,
    ai,
    auth,
    availability,
    courier,
    delivery,
    fleet,
    floor_plans,
    holds,
    reservations,
    restaurants,
    ws,
)

app = FastAPI(title="ITB Restaurant System API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(restaurants.router)
app.include_router(availability.router)
app.include_router(reservations.router)
app.include_router(holds.router)
app.include_router(admin.router)
app.include_router(floor_plans.router)
app.include_router(delivery.router)
app.include_router(courier.router)
app.include_router(fleet.router)
app.include_router(ai.router)
app.include_router(ws.router)


@app.get("/health")
async def health():
    return {"status": "ok"}
