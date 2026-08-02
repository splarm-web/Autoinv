"""Disparador externo de la revisión de correo.

El temporizador interno solo corre mientras el proceso está vivo, y en un plan
gratuito el servicio se duerme tras unos minutos sin visitas: la revisión
automática se para justo cuando más falta hace (de noche, en fin de semana).
Un cron externo llamando aquí resuelve las dos cosas a la vez, porque la
propia petición despierta el servidor.

No lleva autenticación de usuario —un cron no puede iniciar sesión— sino una
clave compartida. Por eso vive en su router y no en el de automatización, que
exige sesión y la feature.
"""

import hmac
import logging

from fastapi import APIRouter, Header, HTTPException, Query

from ...core.config import settings
from ...services import email_worker

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/cron", tags=["cron"])


def _clave_valida(recibida: str | None) -> bool:
    # compare_digest evita filtrar la clave por el tiempo que tarda en comparar
    return bool(recibida) and hmac.compare_digest(recibida, settings.cron_secret)


@router.post("/poll", include_in_schema=False)
def cron_poll(
    token: str | None = Query(None, description="Clave compartida"),
    x_cron_token: str | None = Header(None),
):
    """Revisa los buzones de todas las automatizaciones activas.

    La clave se acepta por cabecera o por query: algunos servicios de cron
    gratuitos solo permiten configurar la URL.
    """
    if not settings.cron_secret:
        raise HTTPException(
            status_code=503,
            detail="El disparador externo está deshabilitado (falta CRON_SECRET)",
        )
    if not (_clave_valida(x_cron_token) or _clave_valida(token)):
        raise HTTPException(status_code=403, detail="Clave no válida")

    try:
        resultado = email_worker.poll_todas()
    except Exception as e:
        logger.exception("cron: fallo revisando el correo")
        raise HTTPException(status_code=500, detail=f"Error al revisar el correo: {e}")

    return {"ok": True, **resultado}
