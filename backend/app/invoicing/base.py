"""Contratos del módulo de facturación.

Para añadir un nuevo diseño de factura:
  1. Crea backend/app/invoicing/designs/<nombre>/
  2. Implementa un renderer que herede de InvoiceRenderer
  3. Regístralo en get_renderer()

El sistema no necesita tocar nada más.
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import date
from pathlib import Path
from typing import List, Optional


@dataclass
class InvoiceLineData:
    description: str
    quantity: float
    unit_price: float
    vat_rate: float
    line_total: float


@dataclass
class IssuerData:
    legal_name: str
    nif: str
    address: str


@dataclass
class ClientData:
    name: str
    tax_id: Optional[str]
    address: Optional[str]


@dataclass
class InvoiceData:
    number: str
    date: date
    due_date: Optional[date]
    payment_method: str
    issuer: IssuerData
    client: ClientData
    lines: List[InvoiceLineData]
    subtotal: float
    vat_total: float
    irpf_total: float
    total: float
    irpf_rate: float = 15.0
    vat_rate: float = 21.0


class InvoiceRenderer(ABC):
    """Interfaz que todo diseño de factura debe implementar."""

    @abstractmethod
    def render_pdf(self, data: InvoiceData, output_path: Path) -> Path:
        """Genera el PDF y lo guarda en output_path. Devuelve la ruta."""
        ...


def get_renderer(design: str = "minimal") -> InvoiceRenderer:
    """Devuelve el renderer del diseño solicitado."""
    if design == "minimal":
        from .designs.minimal.render import MinimalRenderer
        return MinimalRenderer()
    raise ValueError(f"Diseño de factura desconocido: {design!r}")
