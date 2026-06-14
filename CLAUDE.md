# autoinv — Contexto del proyecto para Claude Code

PWA de gestión de facturas y gastos para autónomos en España. Multiusuario.

## Stack

- **Backend:** Python + FastAPI, SQLite (migrable a PostgreSQL), SQLAlchemy ORM, JWT auth (python-jose + passlib/bcrypt)
- **Frontend:** React + Vite, configurado como PWA (vite-plugin-pwa), sin framework CSS — solo CSS custom properties
- **OCR:** Claude Vision vía `anthropic` SDK (extracción de tickets/facturas)
- **PDFs:** WeasyPrint (pendiente de implementar, interfaz lista)
- **Ficheros:** sistema local bajo `backend/data/files/<user_id>/` (estructura preparada para migrar a S3/GCS)
- **Sin Docker** — backend y frontend corren directamente; `host: true` en Vite para acceso LAN desde móvil

## Cómo arrancar

```bash
# Backend
cd backend
python -m venv .venv
.venv\Scripts\activate        # Windows
# source .venv/bin/activate   # Mac/Linux
pip install -r requirements.txt
cp .env.example .env          # editar SECRET_KEY y ANTHROPIC_API_KEY
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload

# Frontend (otra terminal)
cd frontend
npm install
npm run dev
# → http://localhost:5173  |  móvil: http://<IP-local>:5173
```

La BD SQLite se crea automáticamente en `backend/data/app.db` al arrancar.

## Estado del MVP (jun 2026)

### Hecho y commiteado

**Backend:**
- Auth completa: `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/auth/me`, `PATCH /api/auth/me`
- Dashboard: `GET /api/dashboard?periodo=mes|trimestre|anio` → KPIs, IVA, barras por subperiodo, últimos movimientos
- Expenses: CRUD completo + upload foto/PDF + extracción OCR con Claude Vision + confirmación
- Invoices: CRUD + auto-numeración según formato del usuario (`YYYY-NNN`)
- Export: `GET /api/export?from_date=&to_date=` → ZIP con justificantes + PDFs + CSV
- Módulo invoicing desacoplado (`InvoiceData` + `InvoiceRenderer`)

**Frontend:**
- Design tokens en `src/styles/tokens.css` (paleta menta/coral/cielo, Space Grotesk + Hanken Grotesk)
- AppShell: sidebar desktop 212px + bottom nav móvil + overlay
- Dashboard: KPIs, card IVA, gráfico de barras animado, lista movimientos, skeleton loading
- Auth: Login + Register
- Expenses: listado, alta manual, captura foto/PDF con OCR
- Invoices: listado, alta con formulario + vista previa React (`InvoicePreview`)
- Settings: datos fiscales del usuario
- Export: descarga ZIP por rango de fechas

### Pendiente (próximos pasos en orden)

1. **Instalar Python y probar el flujo completo end-to-end** — Python no estaba instalado cuando se creó el scaffold
2. **Renderer PDF** (`backend/app/invoicing/designs/minimal/render.py`) — implementar `render_pdf()` con WeasyPrint usando el HTML del prototipo como `template.html`. La interfaz `InvoiceRenderer` ya está lista; es solo conectar
3. **ANTHROPIC_API_KEY** en `backend/.env` para activar OCR de tickets
4. **Filtros en gastos** — la API ya acepta `from_date`, `to_date`, `category`; falta el UI en `ExpensesPage`
5. **Paginación** en movimientos del dashboard y listados
6. **Múltiples diseños de factura** — añadir `designs/professional/` implementando la misma interfaz

## Arquitectura clave

### Módulo de facturación (no tocar el contrato)

```
backend/app/invoicing/
  base.py                    # InvoiceData + InvoiceRenderer (ABC)
  designs/
    minimal/render.py        # implementa render_pdf() → placeholder txt hoy
    <nuevo>/render.py        # añadir diseños sin tocar nada más
```

Para añadir un diseño: crear carpeta `designs/<nombre>/`, implementar `InvoiceRenderer`, registrar en `base.py:get_renderer()`.

### Vista previa de factura en React

`frontend/src/features/invoices/InvoicePreview.jsx` recibe el mismo `InvoiceData` normalizado que el renderer Python. El formulario de alta calcula los totales en tiempo real y los pasa a la preview antes de guardar.

### OCR de gastos

`backend/app/services/ocr_claude.py` — llama a Claude Vision con el fichero (imagen o PDF), devuelve `OcrResult`. El flujo es: upload → extracción → formulario editable → confirmar (mueve el fichero de temp a uploads y guarda en BD).

### Auth

JWT en `Authorization: Bearer <token>`. Token guardado en `localStorage` (`autoinv_token`). El `AuthContext` lo inyecta en todas las llamadas API via `src/lib/api.js`.

## Estructura de carpetas

```
autoinv/
├── backend/
│   ├── app/
│   │   ├── main.py
│   │   ├── core/            config · database · security
│   │   ├── models/          user · expense · invoice + invoice_lines
│   │   ├── schemas/         pydantic in/out + dashboard
│   │   ├── api/
│   │   │   ├── deps.py      get_current_user
│   │   │   └── routers/     auth · dashboard · expenses · invoices · export
│   │   ├── services/        ocr_claude · storage · export_zip
│   │   └── invoicing/       base.py + designs/minimal/
│   ├── data/                app.db + files/ (gitignored)
│   ├── .env.example
│   └── requirements.txt
└── frontend/
    ├── public/              manifest + icons
    └── src/
        ├── main.jsx
        ├── app/             router · AuthContext
        ├── lib/             api.js · format.js
        ├── styles/          tokens.css
        ├── components/      AppShell
        └── features/        auth · dashboard · expenses · invoices · settings · export
```

## Decisiones de diseño

- **Sin librería de componentes** — solo CSS custom properties y CSS plano por componente
- **Sin TypeScript** — JSX puro para velocidad de iteración
- **SQLite → PostgreSQL** — `DATABASE_URL` en `.env`; SQLAlchemy abstrae el cambio, solo el `connect_args` varía (ya gestionado en `database.py`)
- **Almacenamiento local → nube** — cambiar `FILES_ROOT` en config y actualizar `storage.py`; el resto del código no cambia
- **`amount` en gastos** = total pagado incluyendo IVA; `vat_amount` = porción de IVA
- **`total` en facturas** = subtotal + IVA - IRPF (lo que cobra el autónomo)

## Design tokens de referencia

```
--menta:  #45D49B   ingresos / activo / acento
--coral:  #F0876A   gastos / negativos
--cielo:  #6FA8FF   IVA a liquidar / info
--ink:    #0E1014   fondo app
--surface: #16181E  cards
```

Fuente display/cifras: Space Grotesk. Fuente UI: Hanken Grotesk.
Importes siempre con `font-variant-numeric: tabular-nums`.
