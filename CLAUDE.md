# autoinv — Contexto del proyecto para Claude Code

PWA de gestión de facturas y gastos para autónomos en España. Multiusuario.

## Stack

- **Backend:** Python + FastAPI, SQLite (migrable a PostgreSQL), SQLAlchemy ORM, JWT auth (python-jose + bcrypt directo — passlib eliminado por incompatibilidad con Python 3.14)
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

## Infraestructura desplegada

- **Backend:** https://autoinv-production.up.railway.app (Railway, Python 3.14)
- **Frontend:** https://autoinv.vercel.app (Vercel, React PWA)
- **GitHub:** https://github.com/splarm-web/Autoinv
- **BD:** PostgreSQL en Railway (servicio "Postgres", `DATABASE_URL` por referencia `${{Postgres.DATABASE_URL}}`). Ya NO es efímera. `database.py` normaliza `postgres://`→`postgresql://`
- **Variables Railway:** `SECRET_KEY`, `REGISTRATION_ENABLED`, `ALLOWED_ORIGINS`, `ANTHROPIC_API_KEY` (vacía — OCR desactivado), `DATABASE_URL`, `FILES_ROOT`

### Hecho y funcionando en producción

**Backend:**
- Auth completa: `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/auth/me`, `PATCH /api/auth/me`. **Login admite usuario plano** (no solo email): `UserLogin.email` es `str` (registro sí exige email)
- Toggle registro: `REGISTRATION_ENABLED` en Railway Variables (poner `false` tras registrarte)
- Dashboard: `GET /api/dashboard?periodo=mes|trimestre|anio` → KPIs (ingresos=Σ totales, gastos, **ingresos netos = ingresos − IVA − IRPF**), card impuestos (IVA repercutido/soportado/a liquidar + **IRPF retenido**), barras, últimos movimientos
- Expenses: CRUD completo + filtros (`from_date`, `to_date`, `category`) + upload foto/PDF + OCR Claude Vision + confirmación
- Invoices: CRUD + auto-numeración (`YYYY-NNN`) + `client_id` + **renderer PDF real** + **facturas de transporte**
- Export: `GET /api/export?from_date=&to_date=` → ZIP con justificantes + PDFs + CSV
- Módulo invoicing desacoplado (`InvoiceData` + `InvoiceRenderer`), 2 diseños: `minimal` (fpdf2) y `alfredo` (transporte, reportlab)
- **Clients:** CRUD completo — `GET/POST /api/clients`, `PUT /api/clients/{id}`, `DELETE /api/clients/{id}`, `POST /api/clients/{id}/set-default`
- **Feature flags por usuario:** `users.features` (CSV); `deps.require_feature(key)` → 403 si no la tiene. Endpoints de transporte protegidos

**Frontend:**
- Design tokens en `src/styles/tokens.css` (paleta menta/coral/cielo, Space Grotesk + Hanken Grotesk)
- AppShell: sidebar + bottom nav **filtrados por feature** del usuario
- Dashboard: KPIs (con ingresos netos en verde + hints), card impuestos (IVA + IRPF), gráfico barras, movimientos, skeleton
- Auth: Login (campo "Usuario") + Register
- Expenses: listado **con filtros de fecha/categoría + total**, alta manual, captura foto/PDF con OCR
- Invoices: listado (con badge "Transporte" + botón PDF), alta estándar con preview, **alta de transporte** (Excel → tabla editable → guardar/PDF). Botones de crear **según el tipo de factura del rol**
- Settings: datos fiscales del usuario
- Export: descarga ZIP por rango de fechas
- `vercel.json` con rewrite para routing SPA
- **Clients:** listado, modal alta/edición, badge "Principal", acciones, empty state
- `AuthContext`: `hasFeature()` + refresh de `/me` al cargar; `router` con `FeatureRoute`

**Decisiones tomadas:**
- OCR (Claude Vision) desactivado por ahora — requiere cuenta Anthropic de pago
- Registro abierto temporalmente para setup inicial; cerrar con `REGISTRATION_ENABLED=false` en Railway
- passlib eliminado (incompatible Python 3.14) → bcrypt directo
- **Sergio = autónomo** (features: gastos,facturas,clientes,export); **Alfredo = transportista** (features: transporte,clientes,export). Cuentas separadas; el emisor sale del perfil fiscal del usuario logueado
- PDF: **fpdf2** para minimal (encoding cp1252 para €) y **reportlab** para alfredo; ambos Python puro (sin libs de sistema → despliegan en Railway sin config). WeasyPrint descartado por dependencias nativas

### Hecho esta iteración (2026-06-21)

- ✅ BD migrada a PostgreSQL en Railway
- ✅ Filtros de fecha/categoría en gastos (con total)
- ✅ `client_id` + selector de cliente en alta de facturas
- ✅ Renderer PDF real `minimal` con fpdf2 + endpoint `GET /invoices/{id}/pdf` + botón PDF en listado
- ✅ **Facturas de transporte ("Alfredo")**: parser de Excel (`services/transporte_excel.py`), diseño `alfredo` (reportlab), endpoints `POST /invoices/transporte/parse-excel`, `/transporte/pdf`, `/transporte` (guardar). Frontend `TransporteInvoicePage`
- ✅ Persistencia de transporte: `Invoice.kind` + `Invoice.extra_json` → aparece en el listado y regenera PDF
- ✅ Feature flags por usuario (gating backend + frontend)
- ✅ Login con usuario plano (sergio/alfredo)
- ✅ Botones de crear factura según tipo de rol
- ✅ Fix: dashboard crasheaba en Windows por `strftime('%-d')`
- ✅ Dashboard: IRPF retenido + ingresos netos

### Próximos pasos en orden de prioridad

1. **Endurecer enforcement de features en backend** — hoy solo `transporte` está gateado en el backend; gastos/facturas/clientes/export se ocultan en UI pero sus endpoints no rechazan aún. Añadir `require_feature` a esos routers
2. **Pantalla de admin de features** — gestionar `users.features` desde la UI sin tocar la BD (necesario para asignar features a usuarios nuevos en producción)
3. **Igualar "Descargar PDF" en factura estándar** — la de transporte tiene Guardar + Descargar PDF; la estándar solo guarda (PDF desde el listado)
4. **Paginación** en movimientos del dashboard y listados de gastos/facturas
5. **Activar OCR** — cuando haya API key de Anthropic, añadir `ANTHROPIC_API_KEY` en Railway Variables
6. **Cerrar registro** en producción tras dar de alta a los usuarios (`REGISTRATION_ENABLED=false`)

## Arquitectura clave

### Módulo de facturación (no tocar el contrato)

```
backend/app/invoicing/
  base.py                    # InvoiceData + InvoiceRenderer (ABC)
  designs/
    minimal/render.py        # render_pdf() real con fpdf2 (factura estándar)
    alfredo/render.py        # render_transporte_pdf() con reportlab (transporte)
    <nuevo>/render.py        # añadir diseños sin tocar nada más
```

Para añadir un diseño estándar: crear `designs/<nombre>/`, implementar `InvoiceRenderer`, registrar en `base.py:get_renderer()`.

**Facturas de transporte ("Alfredo"):** flujo aparte del contrato `InvoiceRenderer` (datos distintos: viajes/kilos/cabeza/cisterna, IRPF 1%). `services/transporte_excel.py` parsea el Excel; `designs/alfredo/render.py:render_transporte_pdf(dict)` genera el PDF. Se persiste como `Invoice` con `kind="transporte"` y el payload completo en `extra_json` (para regenerar el PDF desde el listado). Origen: el script `generador_facturas.py` que tenía el usuario (en Descargas, no en el repo).

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
│   │   │   └── routers/     auth · dashboard · expenses · invoices · export · clients
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
        └── features/        auth · dashboard · expenses · invoices · settings · export · clients
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
