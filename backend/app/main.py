from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .core.config import settings
from .core.database import create_tables
from .api.routers import auth, dashboard, expenses, invoices, export, clients

app = FastAPI(
    title="autoinv API",
    description="Gestión de facturas y gastos para autónomos en España",
    version="0.1.0",
)

origins = [o.strip() for o in settings.allowed_origins.split(",")]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api")
app.include_router(dashboard.router, prefix="/api")
app.include_router(expenses.router, prefix="/api")
app.include_router(invoices.router, prefix="/api")
app.include_router(export.router, prefix="/api")
app.include_router(clients.router, prefix="/api")


@app.on_event("startup")
def on_startup():
    settings.files_root.mkdir(parents=True, exist_ok=True)
    create_tables()


@app.get("/api/health")
def health():
    return {"status": "ok"}
