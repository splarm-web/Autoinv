import logging

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

from .core.config import settings
from .core.database import create_tables, ensure_schema
from .api.routers import (
    admin, auth, automation, dashboard, expenses, invoices, export, clients,
)
from .services import email_worker

logger = logging.getLogger(__name__)

app = FastAPI(
    title="autoinv API",
    description="Gestión de facturas y gastos para autónomos en España",
    version="0.1.0",
)

class ErroresConCors(BaseHTTPMiddleware):
    """Convierte una excepción no controlada en una respuesta JSON normal.

    Sin esto, Starlette la gestiona por encima del middleware de CORS: la
    respuesta 500 sale sin las cabeceras y el navegador la bloquea, así que
    en el frontend se ve un inútil "Failed to fetch" en vez del motivo real.
    Se registra el error completo en el log del servidor.
    """

    async def dispatch(self, request: Request, call_next):
        try:
            return await call_next(request)
        except Exception:
            logger.exception("Error no controlado en %s %s", request.method, request.url.path)
            return JSONResponse(
                status_code=500,
                content={"detail": "Error interno del servidor. Revisa los registros."},
            )


# El orden importa: lo añadido después envuelve a lo anterior, así que este
# middleware queda DENTRO del de CORS y su respuesta sí pasa por él.
app.add_middleware(ErroresConCors)

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
app.include_router(admin.router, prefix="/api")
app.include_router(automation.router, prefix="/api")


@app.on_event("startup")
def on_startup():
    settings.files_root.mkdir(parents=True, exist_ok=True)
    create_tables()
    ensure_schema()
    if settings.automation_worker_enabled:
        try:
            email_worker.start_scheduler()
        except Exception as e:
            # Que el polling no arranque no debe impedir servir la API
            logger.error("No se pudo arrancar el worker de automatización: %s", e)


@app.on_event("shutdown")
def on_shutdown():
    email_worker.stop_scheduler()


@app.get("/api/health")
def health():
    return {"status": "ok"}
