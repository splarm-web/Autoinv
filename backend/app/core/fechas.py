"""Utilidades de fecha/hora.

PostgreSQL devuelve los `DateTime(timezone=True)` con zona horaria, pero
SQLite los devuelve sin ella. Comparar unos con otros lanza
"can't compare offset-naive and offset-aware datetimes", así que todo lo que
salga de la base de datos se normaliza antes de operar con ello.
"""

from datetime import datetime, timezone


def como_utc(valor: datetime | None) -> datetime | None:
    """Devuelve la fecha con zona horaria UTC, la tuviera o no."""
    if valor is None:
        return None
    if valor.tzinfo is None:
        return valor.replace(tzinfo=timezone.utc)
    return valor.astimezone(timezone.utc)


def ahora() -> datetime:
    return datetime.now(timezone.utc)
