import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { automationApi } from '../../lib/api'
import { eur2 } from '../../lib/format'
import { useToast } from '../../components/Toast'
import ConfirmDialog from '../../components/ConfirmDialog'
import { IconCheck, IconDownload, IconEdit, IconTrash, IconX } from '../../components/Icons'
import { formatoRelativo } from './AutomationPage'
import TransportePreview from '../invoices/TransportePreview'

/**
 * Bandeja de facturas llegadas por correo.
 *
 * El PDF que se muestra ya es el definitivo (no un borrador): el cliente, el
 * número y la fecha se resolvieron al componerla. Por eso "Aprobar" es un
 * solo toque, y "Editar" queda como salida de emergencia, no como paso
 * obligatorio.
 */
export default function PendingList({ pendientes, cargando, configurada, activa, onCambio, irAConfig, config }) {
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
          config={config}
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

function PendingDetail({ id, config, onClose, onCambio }) {
  const { toast } = useToast()
  const navigate = useNavigate()
  const [detalle, setDetalle] = useState(null)
  const [accion, setAccion] = useState(null)   // 'approve' | 'reject'
  const [confirmarDescarte, setConfirmarDescarte] = useState(false)

  useEffect(() => {
    // `cancelado` es necesario, no defensivo: en desarrollo StrictMode monta,
    // desmonta y vuelve a montar. Sin esta guarda, el blob de la primera
    // ejecución nunca se libera y puede acabar pintándose uno ya revocado.
    let cancelado = false
    automationApi.getPending(id)
      .then((d) => { if (!cancelado) setDetalle(d) })
      .catch((e) => { if (!cancelado) toast.error(e.message) })
    return () => { cancelado = true }
  }, [id, toast])

  // El payload guardado y el que espera la preview no tienen la misma forma
  const d = detalle?.invoice_data
  const datosPreview = d ? {
    emisor: d.emisor,
    cliente: d.cliente,
    meta: {
      numero_factura: d.numero_factura,
      fecha: d.fecha_factura,
      concepto_mes: d.concepto_mes,
      cabeza: d.cabeza,
    },
    viajes: (d.viajes || []).map((v) => ({
      dia: (v.fecha || '').split('-')[2]?.replace(/^0/, '') || '',
      viaje: v.viaje, kilos: v.kilos, precio: v.precio, total: v.total,
    })),
    totals: { base: d.base, irpf: d.irpf, iva: d.iva, total: d.total },
  } : null

  const avisos = detalle?.warnings || []
  const bloqueada = avisos.length > 0

  const aprobar = async () => {
    setAccion('approve')
    try {
      await automationApi.approve(id)
      // El correo sale en segundo plano: no tiene sentido bloquear la
      // pantalla los segundos que tarda Gmail. El resultado se ve luego en
      // la propia factura, dentro del listado.
      if (config?.send_on_approve) {
        toast.success('Factura aprobada · enviándose por email')
      } else {
        toast.success('Factura aprobada y guardada')
      }
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
      setConfirmarDescarte(false)
    } finally {
      setAccion(null)
    }
  }

  // "Editar" reutiliza el alta manual de transporte precargada: no duplicamos
  // un formulario que ya existe y que además aplica la validación de siempre.
  const editar = () => {
    if (!detalle?.invoice_data) return
    navigate('/invoices/transporte', {
      // Los avisos viajan con los datos: llegar al formulario sin saber qué
      // había que corregir obliga a volver atrás a mirarlo.
      state: { prefill: detalle.invoice_data, pendingId: id, warnings: avisos },
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
          <button className="modal-close" onClick={onClose} aria-label="Cerrar"><IconX /></button>
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

          {/* Vista previa en HTML, no el PDF embebido: los navegadores móviles
              no saben mostrar un PDF dentro de un iframe (sale en blanco con un
              botón de "abrir" que no lleva a ninguna parte). Este componente es
              el mismo que usa el alta manual y replica el diseño del PDF. */}
          {datosPreview ? (
            <div className="autom-preview">
              <TransportePreview {...datosPreview} />
            </div>
          ) : (
            <div style={{ ...s.vacio, padding: 30 }}>Cargando vista previa…</div>
          )}

          {/* Decir de antemano si esto va a mandar un correo o no. Sin este
              aviso es fácil aprobar esperando que se envíe, que no se envíe
              (porque el interruptor está apagado) y no enterarse de nada. */}
          {!bloqueada && (
            <div style={s.queHara}>
              {config?.send_on_approve
                ? config?.destinatario_efectivo
                  ? <>Al aprobar se guardará <strong>y se enviará por email a {config.destinatario_efectivo}</strong>.</>
                  : <>El envío está activado pero <strong>no hay destinatario</strong>: se guardará sin enviar.</>
                : <>Al aprobar <strong>solo se guardará</strong>. Para que se mande al cliente, activa
                   «Enviarla al aprobarla» en Configuración (o mándala luego desde el listado de facturas).</>}
            </div>
          )}

          <div className="autom-actions btn-row">
            <button
              onClick={aprobar}
              disabled={bloqueada || accion !== null}
              className="btn btn-success"
              title={bloqueada ? 'Corrige los avisos antes de aprobar' : undefined}
            >
              <IconCheck /> {accion === 'approve' ? 'Guardando…' : 'Aprobar'}
            </button>
            <button onClick={editar} className="btn btn-neutral" disabled={accion !== null}>
              <IconEdit /> Editar
            </button>
            <button onClick={() => automationApi.downloadPendingPdf(id, detalle?.numero_factura)} className="btn btn-neutral">
              <IconDownload /> PDF
            </button>
            <button
              onClick={() => automationApi.downloadPendingExcel(id, detalle?.attachment_name)}
              className="btn btn-neutral"
            >
              <IconDownload /> Excel
            </button>
            <button onClick={() => setConfirmarDescarte(true)} className="btn btn-danger" disabled={accion !== null}>
              <IconTrash /> Descartar
            </button>
          </div>
        </div>
      </div>

      {confirmarDescarte && (
        <ConfirmDialog
          titulo="Descartar factura"
          mensaje={`Vas a descartar la factura ${detalle?.numero_factura || ''} recibida de ${detalle?.email_from || 'el correo'}.`}
          detalle="Desaparecerá de las pendientes y no se emitirá. El correo original seguirá en tu buzón."
          textoConfirmar="Descartar"
          cargando={accion === 'reject'}
          onConfirmar={rechazar}
          onCancelar={() => setConfirmarDescarte(false)}
        />
      )}
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
  queHara: { fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6, background: 'var(--surface-3)', border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', padding: '10px 12px' },
  origen: { fontSize: 12, color: 'var(--text-muted)', display: 'grid', gap: 3 },
  k: { display: 'inline-block', minWidth: 58, color: 'var(--text-muted)', opacity: 0.75 },
  btnPrimary: { padding: '10px 20px', background: 'var(--menta)', color: 'var(--ink)', border: 'none', borderRadius: 'var(--r-sm)', fontFamily: 'var(--font-ui)', fontSize: 14, fontWeight: 600, cursor: 'pointer' },
  btnDisabled: { padding: '10px 20px', background: 'var(--surface-3)', color: 'var(--text-muted)', border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', fontFamily: 'var(--font-ui)', fontSize: 14, fontWeight: 600, cursor: 'not-allowed' },
  btnSecondary: { padding: '10px 18px', background: 'var(--btn-soft)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', fontFamily: 'var(--font-ui)', fontSize: 14, cursor: 'pointer' },
  btnGhost: { padding: '10px 16px', background: 'transparent', color: 'var(--text-muted)', border: 'none', borderRadius: 'var(--r-sm)', fontFamily: 'var(--font-ui)', fontSize: 14, cursor: 'pointer' },
}
