"""PHC-Sync — FastAPI application entrypoint."""
import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.db import engine
from app.models import Base
from app.seed import run_seed
from app.db import SessionLocal

# Import all routers
from app.routers import auth, patients, risk, phcs, inventory, requests, sync, dashboard, ai


@asynccontextmanager
async def lifespan(app: FastAPI):
    # ── Startup ────────────────────────────────────────────────────────────
    Base.metadata.create_all(bind=engine)
    with SessionLocal() as session:
        run_seed(session)
    yield
    # ── Shutdown ───────────────────────────────────────────────────────────


app = FastAPI(
    title="PHC-Sync API",
    description=(
        "Offline-first primary healthcare decision-support platform. "
        "PHC-Sync provides preliminary risk assessment and inventory visibility. "
        "It does NOT replace professional medical diagnosis."
    ),
    version="1.0.0",
    lifespan=lifespan,
)

# ── CORS ───────────────────────────────────────────────────────────────────────
_origins = os.getenv("CORS_ORIGINS", "http://localhost:5173,http://localhost:4173").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers ────────────────────────────────────────────────────────────────────
app.include_router(auth.router)
app.include_router(patients.router)
app.include_router(risk.router)
app.include_router(phcs.router)
app.include_router(inventory.router)
app.include_router(requests.router)
app.include_router(sync.router)
app.include_router(dashboard.router)
app.include_router(ai.router)



@app.get("/")
def health():
    return {"status": "ok", "service": "PHC-Sync API", "version": "1.0.0"}


@app.get("/health")
def healthcheck():
    return {"status": "ok"}
