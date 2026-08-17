from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import admin, ai, availability, holds, reservations, ws

app = FastAPI(title="Restaurant Reservation API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(availability.router)
app.include_router(reservations.router)
app.include_router(holds.router)
app.include_router(admin.router)
app.include_router(ai.router)
app.include_router(ws.router)


@app.get("/health")
async def health():
    return {"status": "ok"}
