"""Envío de notificaciones Web Push (VAPID).

Si no hay claves VAPID configuradas, todas las funciones son no-ops: la
automatización sigue funcionando y el usuario se entera por el contador de la
app. El push es un extra, nunca un requisito.

Nota para iOS: Safari solo entrega push si la PWA está instalada en la
pantalla de inicio. Abierta como web normal no llega nada, y no hay forma de
detectarlo desde el servidor — por eso el aviso se da en la propia UI.
"""

import json
import logging

from sqlalchemy.orm import Session

from ..core.config import settings
from ..models.email_automation import PushSubscription

logger = logging.getLogger(__name__)


def push_disponible() -> bool:
    return bool(settings.vapid_public_key and settings.vapid_private_key)


def send_to_user(db: Session, user_id: int, titulo: str, cuerpo: str,
                 url: str = "/") -> int:
    """Notifica a todos los dispositivos suscritos del usuario.

    Devuelve a cuántos se ha entregado. Las suscripciones caducadas (410/404)
    se borran solas: el navegador las invalida al desinstalar la PWA o limpiar
    datos, y arrastrarlas solo genera errores en cada envío.
    """
    if not push_disponible():
        return 0

    from pywebpush import WebPushException, webpush

    subs = db.query(PushSubscription).filter(
        PushSubscription.user_id == user_id,
    ).all()
    if not subs:
        return 0

    payload = json.dumps({"title": titulo, "body": cuerpo, "url": url})
    entregadas = 0
    caducadas = []

    for sub in subs:
        try:
            webpush(
                subscription_info={
                    "endpoint": sub.endpoint,
                    "keys": {"p256dh": sub.p256dh, "auth": sub.auth},
                },
                data=payload,
                vapid_private_key=settings.vapid_private_key,
                vapid_claims={"sub": settings.vapid_subject},
            )
            entregadas += 1
        except WebPushException as e:
            codigo = getattr(e.response, "status_code", None)
            if codigo in (404, 410):
                caducadas.append(sub)
            else:
                logger.error("push_sender: fallo al notificar (%s) — %s", codigo, e)
        except Exception as e:
            logger.error("push_sender: error inesperado — %s", e)

    for sub in caducadas:
        db.delete(sub)
    if caducadas:
        db.commit()

    return entregadas
