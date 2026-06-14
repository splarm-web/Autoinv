# Handoff: autoinv — Dashboard + plantilla de factura (MVP)

## Resumen
`autoinv` es una PWA de gestión de facturas y gastos para autónomos en España (multiusuario).
Este paquete contiene la **propuesta visual v1**: dirección de diseño, el **dashboard de resumen
fiscal** (pantalla principal, interactiva) y una **plantilla de factura de prueba**. Sirve como
referencia de UI y tokens para empezar el desarrollo. El comportamiento funcional/técnico completo
lo aporta el prompt funcional del proyecto (lo tiene el equipo aparte).

## Sobre los archivos de diseño
El archivo `autoinv Propuesta.dc.html` es una **referencia de diseño creada en HTML** —un prototipo
que muestra el aspecto y el comportamiento deseados, **no** código de producción para copiar tal cual.
La tarea es **recrear estos diseños en el entorno del codebase objetivo** siguiendo el stack ya
definido para el proyecto:

- **Frontend:** React + Vite (PWA). Recrear las pantallas como componentes React reales usando los
  patrones del proyecto. No portar el HTML literal.
- Es un `.dc.html` (Design Component); para inspeccionarlo basta abrirlo en el navegador. Úsalo como
  fuente de verdad visual (colores, tipos, espaciados, copys, estados).

## Fidelidad
**Alta fidelidad (hifi)** para el **dashboard** y el **sistema visual**: colores, tipografía,
espaciado e interacciones son definitivos; recréalos con fidelidad de píxel usando los componentes
y librerías del proyecto.

**Plantilla de prueba (placeholder)** para la **factura**: el diseño definitivo del PDF se
implementará más adelante. Por ahora vale como plantilla general para validar el flujo de generación
(formulario → datos normalizados → render → PDF). No la trates como diseño final.

## Pantallas / Vistas

### 1. Dashboard — "Resumen" (hifi, principal)
- **Propósito:** vista de inicio. El autónomo ve de un vistazo ingresos, gastos, resultado neto e
  IVA del periodo, y sus últimos movimientos.
- **Layout:** app de escritorio con **sidebar fija a la izquierda (212px)** + área de contenido
  fluida. Responsive: en móvil la sidebar pasa a navegación inferior o menú; el contenido apila en
  una sola columna.
  - **Sidebar:** logo arriba (`auto` + `inv` en menta), nav vertical (Resumen activo, Gastos,
    Facturas, Exportar, Ajustes) con item activo en fondo menta translúcido + texto menta; abajo,
    bloque de usuario (avatar iniciales + nombre + plan).
  - **Contenido (padding 28px):**
    - Cabecera: título "Resumen" + etiqueta de periodo, y **segmented control** (Mes / Trimestre /
      Año) alineado a la derecha.
    - **3 KPI cards** en grid de 3 columnas (gap 14px): Ingresos (cifra en menta), Gastos (cifra en
      coral), Resultado neto aprox. (cifra en blanco).
    - Fila de 2 columnas (grid `1fr 1.25fr`, gap 14px): **card de IVA** (Repercutido / Soportado /
      "A liquidar" destacado en azul) y **gráfico de barras** ingresos vs gastos por subperiodo.
    - **Lista de movimientos** (full width): filas con punto de color (menta=ingreso, coral=gasto),
      concepto + meta (fecha · categoría) e importe con signo y color.
- **Interacción clave:** el segmented control de periodo recalcula **todos** los KPIs, el IVA y el
  gráfico. Ver "Interacciones".

### 2. Factura (plantilla de prueba)
- **Propósito:** documento que recibe el cliente; base del generador de PDF (módulo intercambiable,
  un diseño = una carpeta).
- **Layout:** hoja blanca centrada (max 720px, padding 56px) sobre fondo oscuro.
  - Cabecera: monograma + datos del emisor (izq) · "Factura" grande + nº (der).
  - Banda meta de 3 columnas: Emisión / Vencimiento / Forma de pago.
  - Bloques "De" y "Para" en 2 columnas.
  - Tabla de líneas: `Concepto | Cant. | Precio | Importe` (numéricos alineados a la derecha,
    números tabulares).
  - Totales alineados a la derecha: Base imponible, **IVA (21%)**, **Retención IRPF (15%)** en
    negativo/coral, y **Total a percibir** destacado en verde.
  - Footer: IBAN + nota legal de retención.
- **Para producción del PDF:** convertir a `template.html` con CSS de página (`@page`, A4, márgenes,
  saltos de página) para WeasyPrint. Entrada = datos normalizados de la factura; salida = PDF.

## Interacciones y comportamiento
- **Segmented control de periodo (dashboard):** estado `periodo ∈ { mes, trimestre, anio }`
  (default `trimestre`). Al cambiar:
  - KPIs (ingresos, gastos, neto), card de IVA (repercutido/soportado/a liquidar) y barras del
    gráfico se recalculan desde el dataset del periodo.
  - Botón activo: fondo `rgba(69,212,155,0.14)`, texto `#45D49B`, peso 600. Inactivo: transparente,
    texto `#868D99`, peso 500.
- **Gráfico de barras:** alturas en % relativo al valor máximo del periodo; transición
  `height 0.4s cubic-bezier(0.2,0.8,0.2,1)`. Cada barra muestra su importe en `title` (tooltip).
- **Formato numérico:** `toLocaleString('es-ES')`. KPIs sin decimales; IVA y totales de factura con
  2 decimales. Símbolo `€` al final. Importes con `font-variant-numeric: tabular-nums`.
- **Responsive:** diseñar mobile-first real para la captura de gastos (áreas táctiles ≥ 44px). En
  móvil: sidebar → nav inferior; KPIs y grids apilados a 1 columna.

## Gestión de estado (dashboard)
- `periodo`: 'mes' | 'trimestre' | 'anio' (default 'trimestre').
- Datos por periodo (en producción vendrán de `GET /dashboard?periodo=`): `ingresos`, `gastos`,
  `ivaRep` (repercutido), `ivaSop` (soportado), `bars[] {label, ingreso, gasto}`.
- Derivados: `neto = ingresos - gastos`, `ivaLiquidar = ivaRep - ivaSop`.

## Design tokens

### Colores — App (dark)
| Token | Hex | Uso |
|---|---|---|
| ink (fondo) | `#0E1014` | fondo de la app |
| surface | `#16181E` | cards |
| surface-2 | `#121419` | sidebar / bloques de código |
| surface-3 | `#1C1F27` | superficie elevada |
| border | `rgba(255,255,255,0.07)` | bordes de cards |
| text | `#EAEDF2` | texto principal |
| text-muted | `#868D99` | etiquetas / secundario |
| text-soft | `#C5CAD2` | texto de párrafo |
| menta (acento / ingresos) | `#45D49B` | acento, positivos, activo |
| coral (gastos) | `#F0876A` | negativos / gastos |
| cielo (info / IVA) | `#6FA8FF` | IVA a liquidar / info |

### Colores — Factura (light)
| Token | Hex | Uso |
|---|---|---|
| paper | `#FFFFFF` | fondo del documento |
| ink | `#15171C` | texto principal |
| muted | `#6B7280` | secundario |
| label | `#9CA3AF` | etiquetas uppercase |
| hairline | `#E6E7EA` / `#ECECEE` / `#F1F2F4` | separadores |
| accent | `#0F9B6B` | total + monograma |
| irpf | `#C0563A` | retención (negativo) |

### Tipografía
- **Display / marca / cifras:** `Space Grotesk` (400–700). Titulares, logo, todos los importes.
- **UI / texto:** `Hanken Grotesk` (400–700). Interfaz, etiquetas, párrafos.
- Importes siempre con `font-variant-numeric: tabular-nums`.
- Tamaños de referencia: H1 hero 46px / títulos sección 24px / título pantalla 22px / KPI 28px /
  total factura 26px / cuerpo 14–15px / etiquetas 11–13px.
- Etiquetas de campo: 11–12px, `font-weight:600`, `text-transform:uppercase`,
  `letter-spacing:0.06–0.1em`.

### Radios y espaciado
- Border radius: cards 14–16px · documento 6px · botones/segmented 8–11px · pills 99px · chips 99px.
- Gaps de grid: 14px (cards) · 18px (secciones internas).
- Sombra del documento factura: `0 30px 70px -30px rgba(0,0,0,0.7)`.

## Arquitectura propuesta (referencia)
Incluida en detalle dentro de la propuesta (sección 04). Resumen:

```
backend/  FastAPI · SQLite→Postgres · ficheros por usuario (local→nube)
  app/{core, models, schemas, api/routers, services, invoicing/designs/<diseño>/}
  data/{app.db, files/<user_id>/}
frontend/ React + Vite (PWA)
  src/{app, lib, features/{auth,expenses,invoices,dashboard,settings,export}, components}
  public/manifest.webmanifest · service-worker.js
```

Esquema BD: `users` (auth + datos fiscales + `settings_json` extensible), `expenses`
(date, amount, vat, supplier, concept, category, `source`, `file_path`), `invoices`
(number, dates, cliente, subtotal/vat/irpf/total, `pdf_path`) y `invoice_lines`.
Generador de factura: **un diseño = una carpeta** que implementa la misma interfaz
(`InvoiceData` → `InvoiceRenderer`), para añadir diseños sin tocar el resto.

## Pantallas pendientes (NO incluidas en esta propuesta)
Estas se diseñarán/implementarán después; avisar a quien desarrolle que aún no tienen diseño:
captura foto/PDF → formulario editable, listado de gastos con filtros, alta de factura,
ajustes fiscales y exportación (ZIP + CSV). El diseño **definitivo** de la factura también queda
pendiente (la del bundle es plantilla de prueba).

## Archivos
- `autoinv Propuesta.dc.html` — propuesta visual completa: dirección de diseño, dashboard
  interactivo, plantilla de factura y arquitectura. Ábrelo en el navegador para inspeccionar
  valores exactos.
