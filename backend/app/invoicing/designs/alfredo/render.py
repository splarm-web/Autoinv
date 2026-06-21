"""Renderer 'alfredo' — factura de transporte.

Porta fielmente el diseño del script generador_facturas.py original (reportlab),
parametrizando emisor y cliente para que vengan de los datos del usuario/clientes.

Recibe un dict ya normalizado (lo construye el endpoint a partir de los datos
editables que envía el frontend) y produce el PDF.

Estructura del dict:
  emisor:  {nombre, nif, direccion, ciudad, telefono}
  cliente: {nombre, cif, direccion, ciudad}
  numero_factura: str        fecha_factura: "dd/mm/YYYY"
  concepto_mes: str          (ej. "SEPTIEMBRE 2025")
  cabeza: str                cisterna: str
  viajes: [{fecha, viaje, kilos, precio, total}]   (kilos en kg, total en €)
  base, irpf, iva, total: float
"""

from datetime import datetime
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas

VERDE = colors.Color(0.8, 1, 0.8)


def _eur(value: float, simbolo: bool = False) -> str:
    """Formato español: 1.234,56 (con € opcional)."""
    s = f"{value:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")
    return f"{s} €" if simbolo else s


def _miles(value: int) -> str:
    return f"{int(value):,}".replace(",", ".")


def _dia(fecha) -> str:
    if not fecha:
        return ""
    s = str(fecha)
    for fmt in ("%Y-%m-%d", "%d/%m/%Y"):
        try:
            return str(datetime.strptime(s, fmt).day)
        except ValueError:
            continue
    return s[:2]


def render_transporte_pdf(data: dict, output_path: Path) -> Path:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    c = canvas.Canvas(str(output_path), pagesize=A4)
    width, height = A4

    emisor = data.get("emisor", {})
    cliente = data.get("cliente", {})

    _encabezado(c, width, height, emisor,
                data.get("numero_factura", ""), data.get("fecha_factura", ""))
    _datos_cliente(c, width, height, cliente)
    _concepto(c, width, height, data.get("concepto_mes", ""), data.get("cabeza", ""))
    _tabla_viajes(c, width, height, data.get("viajes", []))
    _totales(c, width, height, data)

    c.save()
    return output_path


def _encabezado(c, width, height, emisor, numero_factura, fecha_factura):
    margen_izq = 40
    y = height - 40

    c.setFont("Helvetica-Bold", 11)
    c.drawString(margen_izq, y, emisor.get("nombre", ""))
    c.setFont("Helvetica", 9)
    for linea in [emisor.get("nif", ""), emisor.get("direccion", ""),
                  emisor.get("ciudad", ""), emisor.get("telefono", "")]:
        y -= 13
        if linea:
            c.drawString(margen_izq, y, linea)

    # Número de factura + fecha (derecha)
    yf = height - 40
    c.setFont("Helvetica-Bold", 9)
    c.drawString(width - 150, yf, "FACTURA Nº")
    c.setFillColor(VERDE)
    c.rect(width - 80, yf - 2, 70, 14, fill=1, stroke=0)
    c.setFillColor(colors.black)
    c.setFont("Helvetica-Bold", 10)
    c.drawCentredString(width - 45, yf + 1, numero_factura)

    yf -= 16
    c.setFont("Helvetica-Bold", 9)
    c.drawString(width - 150, yf, "FECHA")
    c.setFont("Helvetica", 9)
    c.drawString(width - 100, yf, fecha_factura)


def _datos_cliente(c, width, height, cliente):
    margen_izq = 40
    y = height - 135

    c.setFont("Helvetica-Bold", 9)
    c.drawString(margen_izq, y, "CLIENTE")
    c.setFont("Helvetica", 9)
    c.drawString(margen_izq + 70, y, cliente.get("nombre", ""))
    c.setFont("Helvetica-Bold", 9)
    c.drawRightString(width - 40, y, "D.N.I/C.I.F")

    y -= 14
    c.setFont("Helvetica", 9)
    c.drawRightString(width - 40, y, cliente.get("cif", ""))

    y -= 16
    c.setFont("Helvetica-Bold", 9)
    c.drawString(margen_izq, y, "DOMICILIO")
    c.setFont("Helvetica", 9)
    c.drawString(margen_izq + 70, y, cliente.get("direccion", ""))
    y -= 14
    c.drawString(margen_izq + 70, y, cliente.get("ciudad", ""))


def _concepto(c, width, height, concepto_mes, cabeza):
    y = height - 205
    c.setFont("Helvetica-Bold", 10)
    c.drawCentredString(width / 2, y, "CONCEPTO")
    y -= 18
    c.setFont("Helvetica", 9)
    texto = "SERVICIO TRANSPORTE REALIZADO"
    if concepto_mes:
        texto += f" EN EL MES DE {concepto_mes}"
    c.drawCentredString(width / 2, y, texto)
    if cabeza:
        y -= 14
        c.drawCentredString(width / 2, y, f"CABEZA TRACTORA {cabeza}")


def _tabla_viajes(c, width, height, viajes):
    margen_izq = 40
    margen_der = width - 40
    y = height - 260

    col_dia = margen_izq
    col_viajes = margen_izq + 40
    col_kilos = margen_der - 180
    col_precio = margen_der - 110
    col_total = margen_der - 50

    c.setFont("Helvetica-Bold", 9)
    c.drawString(col_dia, y, "DIA")
    c.drawString(col_viajes, y, "VIAJES REALIZADOS")
    c.drawRightString(col_kilos, y, "KILOS")
    c.drawRightString(col_precio, y, "PRECIO")
    c.drawRightString(col_total, y, "TOTAL")

    y -= 5
    c.setLineWidth(1.5)
    c.line(margen_izq, y, margen_der, y)
    c.setLineWidth(1)

    c.setFont("Helvetica", 9)
    y -= 15
    total_general = 0.0

    for v in viajes:
        nombre = str(v.get("viaje", ""))[:55]
        c.drawString(col_dia, y, _dia(v.get("fecha")))
        c.drawString(col_viajes, y, nombre)
        c.drawRightString(col_kilos, y, _miles(v.get("kilos", 0)))
        c.drawRightString(col_precio, y, _eur(v.get("precio", 0)))
        c.drawRightString(col_total, y, _eur(v.get("total", 0)))
        total_general += float(v.get("total", 0))
        y -= 13
        if y < 150:
            c.showPage()
            y = height - 50
            c.setFont("Helvetica", 9)

    y -= 15
    c.setFont("Helvetica-Bold", 10)
    c.drawRightString(margen_der, y, f"TOTAL  {_eur(total_general, simbolo=True)}")
    return y


def _totales(c, width, height, data):
    margen_izq = 40
    margen_der = width - 40
    y = 140

    tabla_x = margen_izq + 150
    tabla_width = margen_der - tabla_x
    tabla_height = 38
    col_width = tabla_width / 4
    col1 = tabla_x + col_width * 0.5
    col2 = tabla_x + col_width * 1.5
    col3 = tabla_x + col_width * 2.5
    col4 = tabla_x + col_width * 3.5

    c.setFont("Helvetica-Bold", 9)
    y_header = y + tabla_height - 12

    c.setFillColor(VERDE)
    c.rect(tabla_x + col_width * 3, y_header - 3, col_width, 14, fill=1, stroke=0)
    c.setFillColor(colors.black)
    c.drawCentredString(col1, y_header, "BASE IMPONIBLE")
    c.drawCentredString(col2, y_header, "IRPF(1%)")
    c.drawCentredString(col3, y_header, "IVA (21%)")
    c.drawCentredString(col4, y_header, "TOTAL EUROS")

    y_val = y + 10
    c.setFont("Helvetica", 9)
    c.drawCentredString(col1, y_val, _eur(data.get("base", 0)))
    c.setFillColor(colors.red)
    c.drawCentredString(col2, y_val, f"-{_eur(data.get('irpf', 0))}")
    c.setFillColor(colors.black)
    c.drawCentredString(col3, y_val, _eur(data.get("iva", 0)))
    c.setFont("Helvetica-Bold", 10)
    c.drawCentredString(col4, y_val, _eur(data.get("total", 0), simbolo=True))
