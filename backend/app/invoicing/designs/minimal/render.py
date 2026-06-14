"""Renderer del diseño 'minimal' — placeholder para el MVP.

El PDF real se implementará con WeasyPrint en el siguiente paso.
La interfaz ya está lista: recibe InvoiceData, devuelve Path al PDF.
"""

from pathlib import Path

from ...base import InvoiceData, InvoiceRenderer


class MinimalRenderer(InvoiceRenderer):
    def render_pdf(self, data: InvoiceData, output_path: Path) -> Path:
        # TODO: implementar con WeasyPrint + template.html
        # Por ahora genera un placeholder de texto para no romper el flujo
        output_path.parent.mkdir(parents=True, exist_ok=True)
        output_path.write_text(
            f"FACTURA {data.number} — {data.client.name} — {data.total} €\n"
            "(PDF placeholder — implementación WeasyPrint pendiente)"
        )
        return output_path
