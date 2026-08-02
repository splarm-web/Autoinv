import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { automationApi } from '../../lib/api'
import { eur2 } from '../../lib/format'
import { useToast } from '../../components/Toast'
import { formatoRelativo } from './AutomationPage'

/**
 * Bandeja de facturas llegadas por correo.
 *
 * El PDF que se muestra ya es el definitivo (no un borrador): el cliente, el
 * número y la fecha se resolvieron al componerla. Por eso "Aprobar" es un
 * solo toque, y "Editar" queda como salida de emergencia, no como paso
 * obligatorio.
 */
export default function PendingList({ pendientes, cargando, configurada, activa, onCambio, irAConfig }) {
  const [abierta, setAbierta] = useState(null)

  if (cargando) return <div style={s.vacio}>Cargando…</div>

  if (!pendientes.length) {
    return (
      <div style={s.vacio}>
        <div style={{ fontSize: 30, marginBottom: 10 }}>📭</div>
        <div style={{ fontWeight: 600, marginBottom: 6 }}>No hay facturas por validar</div>
        <div style={{ fontSize: 13, color: 'var(--text-muted)', maxWidth: 380, margin: '0 auto' }}>
          {!configurada
            ? 'Configura la automatización para que las facturas lleguen aquí solas.'
            : !activa
              ? 'La automatización está desactivada. Actívala en Configuración.'
              : 'Cuando llegue un correo con el Excel de viajes, aparecerá aquí listo para aprobar.'}
        </div>
        {!configurada && (
          <button onClick={irAConfig} style={{ ...s.btnPrimary, marginTop: 16 }}>Configurar</button>
        )}
      </div>
    )
  }

  return (
    <>
      <div style={{ display: 'grid', gap: 10 }}>
        {pendientes.map((p) => (
          <PendingCard key={p.id} p={p} onAbrir={() => setAbierta(p.id)} />
        ))}
      </div>
      {abierta && (
        <PendingDetail
          id={abierta}
          onClose={() => setAbierta(null)}
          onCambio={onCambio}
        />
      )}
    </>
  )
}

function PendingCard({ p, onAbrir }) {
  const conAvisos = p.warnings?.length > 0
  return (
    <button onClick={onAbrir} className="autom-card" style={conAvisos ? s.cardWarn : undefined}>
      <div style={{ minWidth: 0, flex: 1, textAlign: 'left' }}>
        <div style={s.cardTop}>
          <span style={s.numero}>{p.numero_factura || '—'}</span>
          {conAvisos && <span style={s.badgeWarn}>Requiere revisión</span>}
        </div>
        <div style={s.cardSub}>
          {p.num_viajes} viaje{p.num_viajes === 1 ? '' : 's'} · {p.attachment_name || 'Excel'}
        </div>
        <div style={s.cardMeta}>
          {p.email_from || 'correo'} · {formatoRelativo(p.created_at)}
        </div>
        {conAvisos && (
          <div style={s.avisos}>{p.warnings.join(' · ')}</div>
        )}
      </div>
      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        <div style={s.importe}>{p.total != null ? eur2(p.total) : '—'}</div>
        <div style={s.verDetalle}>Ver →</div>
      </div>
    </button>
  )
}

function PendingDetail({ id, onClose, onCambio }) {
  const { toast } = useToast()
  const navigate = useNavigate()
  const [detalle, setDetalle] = useState(null)
  const [pdfUrl, setPdfUrl] = useState(null)
  const [accion, setAccion] = useState(null)   // 'approve' | 'reject'

  useEffect(() => {
    // `cancelado` es necesario, no defensivo: en desarrollo StrictMode monta,
    // desmonta y vuelve a montar. Sin esta guarda, el blob de la primera
    // ejecución nunca se libera y puede acabar pintándose uno ya revocado.
    let cancelado = false
    let url = null

    automationApi.getPending(id)
      .then((d) => { if (!cancelado) setDetalle(d) })
      .catch((e) => { if (!cancelado) toast.error(e.message) })

    automationApi.pendingPdfUrl(id)
      .then((u) => {
        if (cancelado) { URL.revokeObjectURL(u); return }
        url = u
        setPdfUrl(u)
      })
      .catch(() => {})

    return () => {
      cancelado = true
      if (url) URL.revokeObjectURL(url)
    }
  }, [id, toast])

  const avisos = detalle?.warnings || []
  const bloqueada = avisos.length > 0

  const aprobar = async () => {
    setAccion('approve')
    try {
      const r = await automationApi.approve(id)
      if (r.send_error) toast.error(`Factura guardada, pero el email falló: ${r.send_error}`)
      else if (r.sent_at) toast.success('Factura guardada y enviada por email')
      else toast.success('Factura guardada')
      onCambio()
      onClose()
    } catch (e) {
      toast.error(e.message || 'No se pudo aprobar')
    } finally {
      setAccion(null)
    }
  }

  const rechazar = async () => {
    setAccion('reject')
    try {
      await automationApi.reject(id)
      toast.info('Factura descartada')
      onCambio()
      onClose()
    } catch (e) {
      toast.error(e.message || 'No se pudo descartar')
    } finally {
      setAccion(null)
    }
  }

  // "Editar" reutiliza el alta manual de transporte precargada: no duplicamos
  // un formulario que ya existe y que además aplica la validación de siempre.
  const editar = () => {
    if (!detalle?.invoice_data) return
    navigate('/invoices/transporte', {
      state: { prefill: detalle.invoice_data, pendingId: id },
    })
  }

  return (
    <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-panel autom-modal">
        <div className="modal-header">
          <h2 className="modal-title">
            {detalle?.numero_factura || 'Factura'}{' '}
            <span style={{ color: 'var(--text-muted)', fontWeight: 400, fontSize: 14 }}>
              {detalle?.total != null ? `· ${eur2(detalle.total)}` : ''}
            </span>
          </h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="autom-modal-body">
          {bloqueada && (
            <div className="autom-banner autom-banner--error" style={{ marginBottom: 0 }}>
              <strong>No se puede aprobar directamente:</strong> {avisos.join(' · ')}.
              Usa <em>Editar</em> para completarla o corregir el número.
            </div>
          )}

          <div style={s.origen}>
            <div><span style={s.k}>De</span> {detalle?.email_from || '—'}</div>
            <div><span style={s.k}>Asunto</span> {detalle?.email_subject || '—'}</div>
            <div><span style={s.k}>Adjunto</span> {detalle?.attachment_name || '—'}</div>
          </div>

          {pdfUrl ? (
            <iframe title="Factura" src={pdfUrl} className="autom-pdf" />
          ) : (
            <div style={{ ...s.vacio, padding: 30 }}>Cargando vista previa…</div>
          )}

          <div className="autom-actions">
            <button
              onClick={aprobar}
              disabled={bloqueada || accion !== null}
              style={bloqueada ? s.btnDisabled : s.btnPrimary}
              title={bloqueada ? 'Corrige los avisos antes de aprobar' : undefined}
            >
              {accion === 'approve' ? 'Guardando…' : '✓ Aprobar'}
            </button>
            <button onClick={editar} style={s.btnSecondary} disabled={accion !== null}>
              ✎ Editar
            </button>
            <button
              onClick={() => automationApi.downloadPendingExcel(id, detalle?.attachment_name)}
              style={s.btnSecondary}
            >
              ⬇ Excel
            </button>
            <button onClick={rechazar} style={s.btnGhost} disabled={accion !== null}>
              {accion === 'reject' ? 'Descartando…' : 'Descartar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

const s = {
  vacio: { textAlign: 'center', padding: '46px 20px', color: 'var(--text-muted)', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-card)' },
  cardWarn: { borderColor: 'rgba(240,135,106,0.4)' },
  cardTop: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3, flexWrap: 'wrap' },
  numero: { fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 16 },
  badgeWarn: { fontSize: 10, fontWeight: 600, color: 'var(--coral)', background: 'rgba(240,135,106,0.12)', border: '1px solid rgba(240,135,106,0.3)', borderRadius: 999, padding: '2px 8px' },
  cardSub: { fontSize: 13, color: 'var(--text)' },
  cardMeta: { fontSize: 11, color: 'var(--text-muted)', marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  avisos: { fontSize: 11, color: 'var(--coral)', marginTop: 6 },
  importe: { fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 15, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' },
  verDetalle: { fontSize: 11, color: 'var(--text-muted)', marginTop: 4 },
  origen: { fontSize: 12, color: 'var(--text-muted)', display: 'grid', gap: 3 },
  k: { display: 'inline-block', minWidth: 58, color: 'var(--text-muted)', opacity: 0.75 },
  btnPrimary: { padding: '10px 20px', background: 'var(--menta)', color: 'var(--ink)', border: 'none', borderRadius: 'var(--r-sm)', fontFamily: 'var(--font-ui)', fontSize: 14, fontWeight: 600, cursor: 'pointer' },
  btnDisabled: { padding: '10px 20px', background: 'var(--surface-3)', color: 'var(--text-muted)', border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', fontFamily: 'var(--font-ui)', fontSize: 14, fontWeight: 600, cursor: 'not-allowed' },
  btnSecondary: { padding: '10px 18px', background: 'var(--btn-soft)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', fontFamily: 'var(--font-ui)', fontSize: 14, cursor: 'pointer' },
  btnGhost: { padding: '10px 16px', background: 'transparent', color: 'var(--text-muted)', border: 'none', borderRadius: 'var(--r-sm)', fontFamily: 'var(--font-ui)', fontSize: 14, cursor: 'pointer' },
}
