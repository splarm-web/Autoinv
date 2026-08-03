import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { automationApi, invoicesApi } from '../../lib/api'
import { eur2, fmtDate } from '../../lib/format'
import { useAuth } from '../../app/AuthContext'
import { useToast } from '../../components/Toast'
import Pagination from '../../components/Pagination'
import ConfirmDialog from '../../components/ConfirmDialog'
import FabDial from '../../components/FabDial'
import {
  IconDownload, IconMail, IconPlus, IconRefresh, IconSliders, IconTrash,
} from '../../components/Icons'
import ExportModal from '../export/ExportModal'
import PendingList from '../automation/PendingList'

const PAGE_SIZE = 15

// Tipos de factura disponibles, cada uno detrás de su feature.
const INVOICE_TYPES = [
  { key: 'facturas',   label: 'Nueva factura',         to: '/invoices/new' },
  { key: 'transporte', label: 'Factura transporte (Alfredo)', to: '/invoices/transporte' },
]

/**
 * Facturas: todo lo relacionado con facturar, en una sola pantalla.
 *
 * Las que llegaron por correo y esperan validación van **arriba**, porque son
 * lo único que pide una acción; el histórico va debajo. Tenerlas en pantallas
 * separadas obligaba a recordar que existía otro sitio donde mirar.
 * La configuración de la automatización, que se toca una vez, vive detrás de
 * un botón.
 */
export default function InvoicesPage() {
  const { hasFeature } = useAuth()
  const { toast } = useToast()
  const navigate = useNavigate()
  const automatiza = hasFeature('automatizacion')

  const [invoices, setInvoices] = useState([])
  const [pendientes, setPendientes] = useState([])
  const [automConfig, setAutomConfig] = useState(null)
  const [loading, setLoading] = useState(true)
  const [downloading, setDownloading] = useState(null)
  const [sending, setSending] = useState(null)
  const [porBorrar, setPorBorrar] = useState(null)
  const [borrando, setBorrando] = useState(false)
  const [page, setPage] = useState(1)
  const [showExport, setShowExport] = useState(false)

  const types = INVOICE_TYPES.filter((t) => hasFeature(t.key))

  const cargar = useCallback(async () => {
    try {
      const lista = await invoicesApi.list()
      setInvoices(lista)
      if (automatiza) {
        const [pend, cfg] = await Promise.all([
          automationApi.listPending().catch(() => []),
          automationApi.getConfig().catch(() => null),
        ])
        setPendientes(pend)
        setAutomConfig(cfg)
        window.dispatchEvent(new Event('automation:changed'))
      }
    } finally {
      setLoading(false)
    }
  }, [automatiza])

  useEffect(() => { cargar() }, [cargar])

  // Mientras haya algún envío en curso se refresca solo: el correo sale en
  // segundo plano, así que el resultado llega después de la respuesta.
  const enviando = invoices.some((i) => i.send_queued_at && !i.sent_at)
  useEffect(() => {
    if (!enviando) return
    const id = setInterval(() => {
      invoicesApi.list().then(setInvoices).catch(() => {})
    }, 3000)
    return () => clearInterval(id)
  }, [enviando])

  const pageCount = Math.ceil(invoices.length / PAGE_SIZE)
  const pageItems = invoices.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const confirmarBorrado = async () => {
    setBorrando(true)
    try {
      await invoicesApi.delete(porBorrar.id)
      setInvoices((prev) => prev.filter((i) => i.id !== porBorrar.id))
      toast.success(`Factura ${porBorrar.number} eliminada`)
      setPorBorrar(null)
    } catch (e) {
      toast.error(e.message || 'No se pudo eliminar')
    } finally {
      setBorrando(false)
    }
  }

  const enviar = async (inv) => {
    const destino = window.prompt(
      inv.sent_at
        ? `Esta factura ya se envió a ${inv.sent_to}.\n\n¿A qué dirección quieres volver a enviarla?`
        : 'Enviar la factura por email a:\n\n(déjalo vacío para usar el destinatario configurado)',
      inv.sent_to || '',
    )
    if (destino === null) return
    setSending(inv.id)
    try {
      const actualizada = await invoicesApi.send(inv.id, destino.trim() || null)
      setInvoices((prev) => prev.map((x) => (x.id === inv.id ? actualizada : x)))
      toast.info('Enviando… te avisamos aquí mismo en cuanto salga')
    } catch (e) {
      toast.error(e.message || 'No se pudo enviar')
      invoicesApi.list().then(setInvoices).catch(() => {})
    } finally {
      setSending(null)
    }
  }

  const download = async (inv) => {
    setDownloading(inv.id)
    try {
      await invoicesApi.downloadPdf(inv.id, inv.number)
    } catch (e) {
      toast.error(e.message || 'No se pudo descargar el PDF')
    } finally {
      setDownloading(null)
    }
  }

  return (
    <div>
      <div style={s.header}>
        <h1 style={s.title}>Facturas</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          {automatiza && (
            <button onClick={() => navigate('/automation')} className="btn btn-neutral btn-sm">
              <IconSliders /> Automatización
            </button>
          )}
          {hasFeature('export') && (
            <button onClick={() => setShowExport(true)} className="btn btn-neutral btn-sm">
              <IconDownload /> Exportar
            </button>
          )}
        </div>
      </div>

      {types.length >= 2 && (
        <div className="cta-row" style={s.ctaRow}>
          {types.map((t, i) => (
            <Link key={t.key} to={t.to} className={'btn ' + (i === 0 ? 'btn-primary' : 'btn-neutral')} style={s.cta}>
              <IconPlus /> {t.label}
            </Link>
          ))}
        </div>
      )}

      {/* Pendientes de validar: lo único que reclama una acción, así que va
          primero. Solo aparece si hay algo, para no meter ruido cuando no. */}
      {automatiza && pendientes.length > 0 && (
        <section style={{ marginBottom: 26 }}>
          <h2 style={s.seccion}>
            Pendientes de validar
            <span style={s.contador}>{pendientes.length}</span>
          </h2>
          <PendingList
            pendientes={pendientes}
            cargando={false}
            configurada
            activa
            config={automConfig}
            onCambio={cargar}
            irAConfig={() => navigate('/automation')}
          />
        </section>
      )}

      {automatiza && pendientes.length > 0 && !loading && invoices.length > 0 && (
        <h2 style={s.seccion}>Todas las facturas</h2>
      )}

      {loading ? (
        <div style={{ color: 'var(--text-muted)', fontSize: 14 }}>Cargando…</div>
      ) : invoices.length === 0 ? (
        <EmptyState types={types} />
      ) : (
        <div style={s.card}>
          {pageItems.map((inv, i) => (
            <div key={inv.id} className="inv-row" style={{ ...s.row, ...(i < pageItems.length - 1 ? s.rowBorder : {}) }}>
              <div className="inv-row-main" style={{ display: 'flex', alignItems: 'center', gap: 13, minWidth: 0 }}>
                <span style={{ ...s.dot, background: 'var(--menta)' }} />
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span>Factura {inv.number} · {inv.client_name}</span>
                    {inv.kind === 'transporte' && <span style={s.badge}>Transporte</span>}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 1 }}>
                    {fmtDate(inv.date)}
                    {inv.due_date ? ` · Vence ${fmtDate(inv.due_date)}` : ''}
                  </div>
                  <EnvioInfo inv={inv} />
                </div>
              </div>
              <div className="inv-row-actions" style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                <span className="amount-nowrap" style={s.importe}>+{eur2(inv.total)}</span>
                <button
                  onClick={() => enviar(inv)}
                  disabled={sending === inv.id || !!inv.send_queued_at}
                  className={'btn btn-icon btn-sm ' + (inv.sent_at ? 'btn-neutral' : 'btn-neutral')}
                  title={inv.sent_at ? 'Volver a enviar por email' : 'Enviar por email'}
                  aria-label={inv.sent_at ? 'Volver a enviar por email' : 'Enviar por email'}
                >
                  {inv.sent_at ? <IconRefresh /> : <IconMail />}
                </button>
                <button
                  onClick={() => download(inv)}
                  disabled={downloading === inv.id}
                  className="btn btn-icon btn-sm btn-neutral"
                  title="Descargar PDF" aria-label="Descargar PDF"
                >
                  <IconDownload />
                </button>
                <button
                  onClick={() => setPorBorrar(inv)}
                  className="btn btn-icon btn-sm btn-danger"
                  title="Eliminar factura" aria-label="Eliminar factura"
                >
                  <IconTrash />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && invoices.length > 0 && (
        <Pagination page={page} pageCount={pageCount} onPage={setPage} />
      )}

      {showExport && <ExportModal scope="facturas" onClose={() => setShowExport(false)} />}

      {porBorrar && (
        <ConfirmDialog
          titulo="Eliminar factura"
          mensaje={`Vas a eliminar la factura ${porBorrar.number} de ${porBorrar.client_name}.`}
          detalle="Esta acción no se puede deshacer. Si ya se la enviaste al cliente, él seguirá teniendo su copia."
          textoConfirmar="Eliminar factura"
          cargando={borrando}
          onConfirmar={confirmarBorrado}
          onCancelar={() => setPorBorrar(null)}
        />
      )}

      {/* Mismo botón flotante que en General: un único componente para las dos
          pantallas, así no se separan con el tiempo. */}
      <FabDial acciones={types.map((t) => ({ to: t.to, label: t.label }))} />
    </div>
  )
}

/**
 * Constancia del envío por email: a quién y cuándo, o por qué falló.
 * Va en la propia fila porque responde de un vistazo a "¿esto ya se lo mandé?".
 */
function EnvioInfo({ inv }) {
  if (inv.send_queued_at && !inv.sent_at) {
    return <div style={s.envioCurso}>Enviando…</div>
  }
  if (inv.sent_at) {
    return (
      <div style={s.envioOk}>
        ✓ Enviada a <strong>{inv.sent_to}</strong> el {fmtDateTime(inv.sent_at)}
      </div>
    )
  }
  if (inv.send_error) {
    return <div style={s.envioError} title={inv.send_error}>⚠ No se pudo enviar: {inv.send_error}</div>
  }
  return <div style={s.envioNo}>Sin enviar</div>
}

function fmtDateTime(iso) {
  const d = new Date(iso)
  if (isNaN(d)) return ''
  return `${d.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' })} a las ${d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}`
}

function EmptyState({ types }) {
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-card)', padding: '48px 24px', textAlign: 'center' }}>
      <div style={{ fontSize: 32, marginBottom: 12 }}>📄</div>
      <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>Sin facturas todavía</div>
      <div style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 20 }}>
        Crea tu primera factura para empezar.
      </div>
      {types.length === 0 ? (
        <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
          Tu cuenta no tiene ningún tipo de factura asignado.
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
          {types.map((t, i) => (
            <Link key={t.key} to={t.to} className={'btn ' + (i === 0 ? 'btn-primary' : 'btn-neutral')}>
              <IconPlus /> {t.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

const s = {
  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, gap: 10, flexWrap: 'wrap' },
  title: { fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 22, margin: 0, letterSpacing: '-0.01em' },
  seccion: { fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 600, margin: '0 0 12px', display: 'flex', alignItems: 'center', gap: 9 },
  contador: { fontSize: 11, fontWeight: 700, color: '#fff', background: 'var(--coral)', borderRadius: 999, minWidth: 20, height: 20, padding: '0 6px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' },
  ctaRow: { display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap' },
  cta: { padding: '14px 22px', fontSize: 15, borderRadius: 'var(--r-card)' },
  card: { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-card)', padding: '0 20px' },
  row: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 0' },
  rowBorder: { borderBottom: '1px solid var(--border-soft)' },
  dot: { width: 8, height: 8, borderRadius: 99, flexShrink: 0 },
  importe: { fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 15, color: 'var(--menta)', fontVariantNumeric: 'tabular-nums', marginRight: 4 },
  envioCurso: { fontSize: 11, color: 'var(--cielo)', marginTop: 3, lineHeight: 1.45 },
  envioOk: { fontSize: 11, color: 'var(--menta)', marginTop: 3, lineHeight: 1.45, overflowWrap: 'anywhere' },
  envioError: { fontSize: 11, color: 'var(--coral)', marginTop: 3, lineHeight: 1.45, overflowWrap: 'anywhere' },
  envioNo: { fontSize: 11, color: 'var(--text-muted)', marginTop: 3, opacity: 0.75 },
  badge: { fontSize: 10, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--cielo)', background: 'rgba(111,168,255,0.12)', border: '1px solid rgba(111,168,255,0.25)', borderRadius: 999, padding: '2px 8px' },
}
