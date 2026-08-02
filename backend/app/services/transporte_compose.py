"""Composición de una factura de transporte a partir del Excel parseado.

El Excel solo trae los viajes (y a veces cabeza/cisterna): no sabe nada del
cliente, del número de factura ni de la fecha de emisión. Esos datos salen del
perfil fiscal del usuario y de la configuración de la automatización, y es
aquí donde se juntan las dos mitades.

Reglas (las mismas que aplica el alta manual, para que automático y manual
produzcan facturas idénticas):
  · fecha    = último día del mes de los viajes, o la de recepción del correo
  · número   = prefijo del usuario + mes de la fecha  (agosto → "A8")
  · concepto = "AGOSTO 2025" a partir del mes de los viajes
"""

import calendar
from datetime import date, datetime

MESES = [
    "ENERO", "FEBRERO", "MARZO", "ABRIL", "MAYO", "JUNIO",
    "JULIO", "AGOSTO", "SEPTIEMBRE", "OCTUBRE", "NOVIEMBRE", "DICIEMBRE",
]


def _parse_iso(value) -> date | None:
    """Convierte a date lo que traiga el parser del Excel (ISO o date)."""
    if isinstance(value, date):
        return value
    if not value:
        return None
    try:
        return datetime.strptime(str(value)[:10], "%Y-%m-%d").date()
    except ValueError:
        return None


def mes_de_los_viajes(viajes: list[dict]) -> date | None:
    """Primera fecha válida de la lista de viajes.

    Se usa la primera y no la más frecuente a propósito: es lo que hace el
    formulario manual al derivar el concepto, y conviene que coincidan.
    """
    for v in viajes or []:
        d = _parse_iso(v.get("fecha"))
        if d:
            return d
    return None


def ultimo_dia_del_mes(d: date) -> date:
    return date(d.year, d.month, calendar.monthrange(d.year, d.month)[1])


def numero_factura(prefix: str, fecha: date) -> str:
    return f"{prefix or 'A'}{fecha.month}"


def concepto_mes(d: date | None) -> str:
    return f"{MESES[d.month - 1]} {d.year}" if d else ""


def compose(parsed: dict, user, client, config, fecha_recepcion: date | None = None) -> dict:
    """Monta el payload completo que espera `render_transporte_pdf`.

    parsed  — salida de `services.transporte_excel.parse()`
    user    — el User dueño de la automatización (emisor)
    client  — el Client fijado en la configuración (puede ser None)
    config  — el EmailAutomation (aporta fecha_origen y cabeza/cisterna por defecto)
    """
    viajes = parsed.get("viajes", []) or []
    mes_viajes = mes_de_los_viajes(viajes)
    recepcion = fecha_recepcion or date.today()

    origen = getattr(config, "fecha_origen", "fin_de_mes") or "fin_de_mes"
    if origen == "fin_de_mes" and mes_viajes:
        fecha = ultimo_dia_del_mes(mes_viajes)
    else:
        fecha = recepcion

    prefix = getattr(user, "transporte_invoice_prefix", None) or "A"

    return {
        "emisor": {
            "nombre": (user.legal_name or "") if user else "",
            "nif": (user.nif or "") if user else "",
            "direccion": (user.address or "") if user else "",
            "ciudad": "",
            "telefono": "",
        },
        "cliente": {
            "nombre": (client.nombre or "") if client else "",
            "cif": (client.cif or "") if client else "",
            "direccion": (client.direccion or "") if client else "",
            "ciudad": (client.ciudad or "") if client else "",
        },
        # De qué ficha salió el cliente. Lo necesita la pantalla de edición
        # para preseleccionarlo y para poder corregir la ficha si falta algo
        # (si no, el mismo dato faltaría otra vez el mes que viene).
        "client_id": client.id if client else None,
        "numero_factura": numero_factura(prefix, fecha),
        "fecha_factura": fecha.strftime("%d/%m/%Y"),
        "fecha_iso": fecha.isoformat(),
        "concepto_mes": concepto_mes(mes_viajes),
        "cabeza": parsed.get("cabeza") or getattr(config, "default_cabeza", "") or "",
        "cisterna": parsed.get("cisterna") or getattr(config, "default_cisterna", "") or "",
        "viajes": viajes,
        "base": parsed.get("base", 0),
        "irpf": parsed.get("irpf", 0),
        "iva": parsed.get("iva", 0),
        "total": parsed.get("total", 0),
    }


def validate(payload: dict) -> list[str]:
    """Campos obligatorios que faltan. Mismos criterios que el alta manual.

    Mientras devuelva algo, la factura no puede aprobarse automáticamente:
    cae a pendiente para que el usuario complete lo que falte.
    """
    emisor = payload.get("emisor", {})
    cliente = payload.get("cliente", {})
    faltan = []

    if not (emisor.get("nombre") or "").strip():
        faltan.append("Nombre del emisor")
    if not (emisor.get("nif") or "").strip():
        faltan.append("NIF del emisor")
    if not (emisor.get("direccion") or "").strip():
        faltan.append("Dirección del emisor")
    if not (cliente.get("nombre") or "").strip():
        faltan.append("Cliente")
    if not (cliente.get("cif") or "").strip():
        faltan.append("CIF/DNI del cliente")
    if not (cliente.get("direccion") or "").strip():
        faltan.append("Dirección del cliente")
    if not (payload.get("numero_factura") or "").strip():
        faltan.append("Nº de factura")
    if not (payload.get("concepto_mes") or "").strip():
        faltan.append("Concepto (mes)")
    if not payload.get("viajes"):
        faltan.append("Al menos un viaje")

    return faltan
