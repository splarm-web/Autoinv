import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { automationApi } from '../../lib/api'
import { useToast } from '../../components/Toast'
import { IconRefresh } from '../../components/Icons'
import AutomationConfig from './AutomationConfig'
import './automation.css'

/**
 * Ajustes de la automatización por email.
 *
 * Las facturas pendientes ya NO viven aquí: están en Facturas, junto al resto,
 * que es donde se buscan. Esta pantalla es solo configuración — se toca una vez
 * y casi nunca más.
 */
export default function AutomationPage() {
  const { toast } = useToast()
  const navigate = useNavigate()
  const [status, setStatus] = useState(null)
  const [revisando, setRevisando] = useState(false)

  const recargar = useCallback(async () => {
    try {
      setStatus(await automationApi.status())
      window.dispatchEvent(new Event('automation:changed'))
    } catch (e) {
      toast.error(e.message || 'No se pudo cargar la automatización')
    }
  }, [toast])

  useEffect(() => { recargar() }, [recargar])

  const revisarAhora = async () => {
    setRevisando(true)
    try {
      const r = await automationApi.pollNow()
      if (r.created) {
        toast.success(`${r.message}. Las tienes en Facturas.`)
        navigate('/invoices')
      } else {
        toast.info(r.message)
      }
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
            Las facturas que llegan por correo se preparan solas y aparecen en
            Facturas esperando tu visto bueno.
          </p>
        </div>
        {status?.enabled && (
          <button onClick={revisarAhora} disabled={revisando} className="btn btn-neutral btn-sm">
            <IconRefresh /> {revisando ? 'Revisando…' : 'Revisar ahora'}
          </button>
        )}
      </div>

      <EstadoBanner status={status} />

      <AutomationConfig status={status} onCambio={recargar} />
    </div>
  )
}

function EstadoBanner({ status }) {
  if (!status) return null

  if (!status.configured) {
    return (
      <div className="autom-banner autom-banner--info">
        Todavía no has configurado la automatización. Rellena la conexión y elige
        el cliente al que se facturan los viajes.
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
}
