"""Extracción de datos de tickets/facturas usando Claude Vision.

Entrada:  bytes del fichero + content_type
Salida:   OcrResult (campos opcionales; el usuario confirma antes de guardar)
"""

import base64
import json
from pathlib import Path

from ..core.config import settings
from ..schemas.expense import OcrResult

_SYSTEM = """Eres un asistente de contabilidad para autónomos en España.
Se te proporciona la imagen de un ticket o factura. Extrae los siguientes datos y
devuélvelos como JSON válido con estas claves (todas opcionales, usa null si no puedes
determinar el valor con seguridad):

{
  "date": "YYYY-MM-DD",
  "amount": <número decimal, total pagado incluyendo IVA>,
  "vat_rate": <porcentaje, ej: 21.0>,
  "vat_amount": <importe del IVA en euros>,
  "supplier": "<nombre del comercio o proveedor>",
  "concept": "<descripción breve del gasto>",
  "category": "<una de: Software/Servicios digitales, Oficina/Coworking, Transporte,
                Formación, Marketing/Publicidad, Material/Equipamiento,
                Consultoría/Asesoría, Seguros, Suministros, Otros>"
}

Responde SOLO con el JSON, sin texto adicional.
"""


async def extract(content: bytes, content_type: str, file_path: Path) -> OcrResult:
    if not settings.anthropic_api_key:
        return OcrResult()

    import anthropic  # importación diferida para no fallar si no está instalado

    client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)

    if content_type == "application/pdf":
        encoded = base64.standard_b64encode(content).decode()
        message_content = [
            {
                "type": "document",
                "source": {"type": "base64", "media_type": "application/pdf", "data": encoded},
            },
            {"type": "text", "text": "Extrae los datos de este documento."},
        ]
    else:
        encoded = base64.standard_b64encode(content).decode()
        message_content = [
            {
                "type": "image",
                "source": {"type": "base64", "media_type": content_type, "data": encoded},
            },
            {"type": "text", "text": "Extrae los datos de este ticket o factura."},
        ]

    response = await client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=512,
        system=_SYSTEM,
        messages=[{"role": "user", "content": message_content}],
    )

    raw = response.content[0].text.strip()
    # Elimina bloques de código markdown si los hay
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
    try:
        data = json.loads(raw)
        return OcrResult(**{k: v for k, v in data.items() if v is not None})
    except Exception:
        return OcrResult()
