import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { invoicesApi } from '../../lib/api'
import { eur2, fmtDate } from '../../lib/format'
import { useAuth } from '../../app/AuthContext'
import { useToast } from '../../components/Toast'
import Pagination from '../../components/Pagination'
import ExportModal from '../export/ExportModal'

const PAGE_SIZE = 15

// Tipos de factura disponibles, cada uno detrás de su feature.
const INVOICE_TYPES = [
  { key: 'facturas',   label: 'Nueva factura',         to: '/invoices/new' },
  { key: 'transporte', label: 'Factura transporte (Alfredo)', to: '/invoices/transporte' },
]

export default function InvoicesPage() {
  const { hasFeature } = useAuth()
  const { toast } = useToast()
  const [invoices, setInvoices] = useState([])
  const [loading, setLoading] = useState(true)
  const [downloading, setDownloading] = useState(null)
  const [sending, setSending] = useState(null)
  const [page, setPage] = useState(1)
  const [showExport, setShowExport] = useState(false)
  const [dialOpen, setDialOpen] = useState(false)

  // Tipos que este usuario puede crear según su rol
  const types = INVOICE_TYPES.filter((t) => hasFeature(t.key))

  useEffect(() => {
    invoicesApi.list().then(setInvoices).finally(() => setLoading(false))
  }, [])

  const pageCount = Math.ceil(invoices.length / PAGE_SIZE)
  const pageItems = invoices.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const remove = async (id) => {
    if (!confirm('¿Eliminar esta factura?')) return
    try {
      await invoicesApi.delete(id)
      setInvoices((prev) => prev.filter((i) => i.id !== id))
      toast.success('Factura eliminada')
    } catch (e) {
      toast.error(e.message || 'No se pudo eliminar')
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
      toast.success(`Factura enviada a ${actualizada.sent_to}`)
    } catch (e) {
      toast.error(e.message || 'No se pudo enviar')
      // Recargar para que quede visible el motivo del fallo en la propia fila
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
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, gap: 10, flexWrap: 'wrap' }}>
        <h1 style={s.title}>Facturas</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          {hasFeature('export') && (
            <button onClick={() => setShowExport(true)} style={s.btnSecondaryBtn}>⬇ Exportar</button>
          )}
          {/* Un solo tipo: botón arriba a la derecha (FAB en móvil) */}
          {types.length === 1 && (
            <Link to={types[0].to} className="fab-add" style={s.btnPrimary}>
              <span className="fab-icon">+</span><span className="fab-label"> {types[0].label}</span>
            </Link>
          )}
        </div>
      </div>

      {/* Varios tipos, escritorio: CTAs prominentes en el flujo de la página.
          En móvil se ocultan (ver .cta-row en responsive.css) y aparece en
          su lugar el FAB con speed-dial de más abajo. */}
      {types.length >= 2 && (
        <div className="cta-row" style={s.ctaRow}>
          {types.map((t, i) => (
            <Link key={t.key} to={t.to} style={i === 0 ? s.ctaPrimary : s.ctaSecondary}>
              + {t.label}
            </Link>
          ))}
        </div>
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
              <div className="inv-row-actions" style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
                <span className="amount-nowrap" style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 15, color: 'var(--menta)', fontVariantNumeric: 'tabular-nums' }}>
                  +{eur2(inv.total)}
                </span>
                <button
                  onClick={() => enviar(inv)}
                  disabled={sending === inv.id}
                  style={inv.sent_at ? s.sentBtn : s.pdfBtn}
                  title={inv.sent_at ? 'Volver a enviar por email' : 'Enviar por email'}
                >
                  {sending === inv.id ? '…' : inv.sent_at ? '↻' : '✉'}
                </button>
                <button
                  onClick={() => download(inv)}
                  disabled={downloading === inv.id}
                  style={s.pdfBtn}
                  title="Descargar PDF"
                >
                  {downloading === inv.id ? '…' : 'PDF'}
                </button>
                <button onClick={() => remove(inv.id)} style={s.delBtn} title="Eliminar">✕</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && invoices.length > 0 && (
        <Pagination page={page} pageCount={pageCount} onPage={setPage} />
      )}

      {showExport && <ExportModal scope="facturas" onClose={() => setShowExport(false)} />}

      {/* Varios tipos, móvil: FAB único que despliega los tipos al pulsar
          (evita tener 2 botones grandes permanentes compitiendo con el
          contenido de la página; en escritorio ya se ven en .cta-row). */}
      {types.length >= 2 && (
        <div className={'fab-dial' + (dialOpen ? ' open' : '')}>
          {dialOpen && <div className="fab-dial-backdrop" onClick={() => setDialOpen(false)} />}
          <div className="fab-dial-options">
            {types.map((t) => (
              <Link key={t.key} to={t.to} className="fab-dial-option" onClick={() => setDialOpen(false)}>
                <span className="fab-dial-option-label">{t.label}</span>
                <span className="fab-dial-option-icon">+</span>
              </Link>
            ))}
          </div>
          <button
            type="button"
            className="fab-dial-trigger"
            onClick={() => setDialOpen((v) => !v)}
            aria-label={dialOpen ? 'Cerrar opciones' : 'Nueva factura'}
          >
            <span className="fab-dial-trigger-icon">{dialOpen ? '×' : '+'}</span>
          </button>
        </div>
      )}
    </div>
  )
}

/**
 * Constancia del envío por email: a quién y cuándo, o por qué falló.
 *
 * Se muestra en la propia fila y no escondido en un detalle porque es lo que
 * responde de un vistazo a "¿esta factura ya se la mandé al cliente?".
 */
function EnvioInfo({ inv }) {
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

// dd/mm/aaaa a las HH:MM, en hora local
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
            <Link key={t.key} to={t.to} style={i === 0 ? s.btnPrimary : s.btnSecondary}>
              + {t.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

const s = {
  title: { fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 22, margin: 0, letterSpacing: '-0.01em' },
  btnPrimary: { display: 'inline-block', padding: '9px 18px', background: 'var(--menta)', color: 'var(--ink)', borderRadius: 'var(--r-sm)', fontWeight: 600, fontSize: 14, textDecoration: 'none' },
  btnSecondary: { display: 'inline-block', padding: '9px 18px', background: 'var(--btn-soft)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', fontWeight: 600, fontSize: 14, textDecoration: 'none' },
  btnSecondaryBtn: { padding: '9px 18px', background: 'var(--btn-soft)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', fontWeight: 600, fontSize: 14, cursor: 'pointer', fontFamily: 'var(--font-ui)' },
  ctaRow: { display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap' },
  ctaPrimary: { display: 'inline-flex', alignItems: 'center', padding: '14px 22px', background: 'var(--menta)', color: 'var(--ink)', borderRadius: 'var(--r-card)', fontWeight: 600, fontSize: 15, textDecoration: 'none' },
  ctaSecondary: { display: 'inline-flex', alignItems: 'center', padding: '14px 22px', background: 'var(--surface)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 'var(--r-card)', fontWeight: 600, fontSize: 15, textDecoration: 'none' },
  card: { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-card)', padding: '0 20px' },
  row: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 0' },
  rowBorder: { borderBottom: '1px solid var(--border-soft)' },
  dot: { width: 8, height: 8, borderRadius: 99, flexShrink: 0 },
  envioOk: { fontSize: 11, color: 'var(--menta)', marginTop: 3, lineHeight: 1.45, overflowWrap: 'anywhere' },
  envioError: { fontSize: 11, color: 'var(--coral)', marginTop: 3, lineHeight: 1.45, overflowWrap: 'anywhere' },
  envioNo: { fontSize: 11, color: 'var(--text-muted)', marginTop: 3, opacity: 0.75 },
  sentBtn: { background: 'rgba(69,212,155,0.12)', border: '1px solid rgba(69,212,155,0.3)', color: 'var(--menta)', borderRadius: 'var(--r-sm)', padding: '5px 10px', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-ui)' },
  badge: { fontSize: 10, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--cielo)', background: 'rgba(111,168,255,0.12)', border: '1px solid rgba(111,168,255,0.25)', borderRadius: 999, padding: '2px 8px' },
  pdfBtn: { background: 'none', border: '1px solid var(--border)', color: 'var(--text)', cursor: 'pointer', fontSize: 12, fontWeight: 600, padding: '4px 10px', borderRadius: 'var(--r-sm)', letterSpacing: '0.02em' },
  delBtn: { background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 14, padding: '2px 4px', borderRadius: 4 },
}
