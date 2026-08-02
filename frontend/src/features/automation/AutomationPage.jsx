import { useCallback, useEffect, useState } from 'react'
import { automationApi } from '../../lib/api'
import { useToast } from '../../components/Toast'
import PendingList from './PendingList'
import AutomationConfig from './AutomationConfig'
import './automation.css'

/**
 * Automatización por email.
 *
 * Dos pestañas: la bandeja de facturas que han llegado por correo y esperan
 * validación, y la configuración. La bandeja va primero porque es lo que se
 * consulta a diario; la configuración se toca una vez y casi nunca más.
 */
export default function AutomationPage() {
  const { toast } = useToast()
  const [tab, setTab] = useState('pendientes')
  const [status, setStatus] = useState(null)
  const [pendientes, setPendientes] = useState([])
  const [config, setConfig] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [revisando, setRevisando] = useState(false)

  const recargar = useCallback(async () => {
    try {
      const [st, pend, cfg] = await Promise.all([
        automationApi.status(),
        automationApi.listPending(),
        automationApi.getConfig().catch(() => null),
      ])
      setStatus(st)
      setPendientes(pend)
      setConfig(cfg)
      // Refresca el badge del menú sin esperar a su siguiente sondeo
      window.dispatchEvent(new Event('automation:changed'))
    } catch (e) {
      toast.error(e.message || 'No se pudo cargar la automatización')
    } finally {
      setCargando(false)
    }
  }, [toast])

  useEffect(() => { recargar() }, [recargar])

  const revisarAhora = async () => {
    setRevisando(true)
    try {
      const r = await automationApi.pollNow()
      if (r.created) toast.success(r.message)
      else toast.info(r.message)
      await recargar()
    } catch (e) {
      toast.error(e.message || 'No se pudo revisar el correo')
    } finally {
      setRevisando(false)
    }
  }

  return (
    <div>
      <div className="autom-header">
        <div>
          <h1 style={s.title}>Automatización</h1>
          <p style={s.subtitle}>
            Las facturas que llegan por correo se preparan solas y esperan aquí tu visto bueno.
          </p>
        </div>
        {status?.enabled && (
          <button onClick={revisarAhora} disabled={revisando} style={s.btnSecondary}>
            {revisando ? 'Revisando…' : '↻ Revisar ahora'}
          </button>
        )}
      </div>

      <EstadoBanner status={status} cargando={cargando} />

      <div className="modal-tabs autom-tabs">
        <button
          className={'modal-tab' + (tab === 'pendientes' ? ' active' : '')}
          onClick={() => setTab('pendientes')}
        >
          Pendientes{pendientes.length > 0 ? ` (${pendientes.length})` : ''}
        </button>
        <button
          className={'modal-tab' + (tab === 'config' ? ' active' : '')}
          onClick={() => setTab('config')}
        >
          Configuración
        </button>
      </div>

      {tab === 'pendientes' ? (
        <PendingList
          pendientes={pendientes}
          cargando={cargando}
          configurada={status?.configured}
          activa={status?.enabled}
          onCambio={recargar}
          irAConfig={() => setTab('config')}
          config={config}
        />
      ) : (
        <AutomationConfig status={status} onCambio={recargar} />
      )}
    </div>
  )
}

function EstadoBanner({ status, cargando }) {
  if (cargando || !status) return null

  if (!status.configured) {
    return (
      <div className="autom-banner autom-banner--info">
        Todavía no has configurado la automatización. Ve a <strong>Configuración</strong> para
        conectar tu correo y elegir el cliente al que se facturan los viajes.
      </div>
    )
  }
  if (status.last_error) {
    return (
      <div className="autom-banner autom-banner--error">
        <strong>Último intento fallido:</strong> {status.last_error}
      </div>
    )
  }
  if (!status.enabled) {
    return (
      <div className="autom-banner autom-banner--warn">
        La automatización está <strong>desactivada</strong>: no se está revisando el correo.
      </div>
    )
  }
  // Que la revisión se pare no rompe nada visible: las facturas simplemente
  // dejan de llegar. Sin este aviso se descubriría tarde y por el lado malo.
  if (status.poll_stale) {
    return (
      <div className="autom-banner autom-banner--warn">
        <strong>La revisión automática lleva parada {textoDesde(status.minutes_since_poll)}.</strong>{' '}
        Puede que las facturas nuevas no estén llegando. Pulsa «Revisar ahora» para
        comprobarlo; si se repite, revisa que el disparador externo siga activo.
      </div>
    )
  }
  return (
    <div className="autom-banner autom-banner--ok">
      <span className="autom-dot" /> Activa · {status.last_poll_at
        ? `última revisión ${formatoRelativo(status.last_poll_at)}`
        : 'aún sin revisar'}
    </div>
  )
}

// "3 horas", "2 días"… a partir de minutos
function textoDesde(minutos) {
  if (minutos == null) return 'un tiempo'
  if (minutos < 120) return `${minutos} minutos`
  const horas = Math.round(minutos / 60)
  if (horas < 48) return `${horas} horas`
  return `${Math.round(horas / 24)} días`
}

export function formatoRelativo(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  const mins = Math.round((Date.now() - d.getTime()) / 60000)
  if (mins < 1) return 'hace un momento'
  if (mins < 60) return `hace ${mins} min`
  const horas = Math.round(mins / 60)
  if (horas < 24) return `hace ${horas} h`
  return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })
}

const s = {
  title: { fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 22, margin: 0, letterSpacing: '-0.01em' },
  subtitle: { color: 'var(--text-muted)', fontSize: 13, margin: '6px 0 0', maxWidth: 520 },
  btnSecondary: { padding: '9px 16px', background: 'var(--btn-soft)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', fontFamily: 'var(--font-ui)', fontSize: 13, cursor: 'pointer', whiteSpace: 'nowrap' },
}
