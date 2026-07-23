import { createContext, useCallback, useContext, useEffect, useState } from 'react'

/**
 * Sistema de notificaciones (toasts) global + indicador de "cold start" del
 * backend en Render (la primera petición tras dormirse puede tardar ~40s).
 *
 * Uso:
 *   const { toast } = useToast()
 *   toast.success('Guardado')   toast.error('Falló')   toast.info('…')
 *
 * El indicador de cold-start escucha eventos `api:waking` que emite lib/api.js
 * cuando una petición tarda más de la cuenta.
 */

const ToastCtx = createContext(null)
export const useToast = () => useContext(ToastCtx)

let _id = 0

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const [waking, setWaking] = useState(false)

  const dismiss = useCallback((id) => {
    setToasts((list) => list.filter((t) => t.id !== id))
  }, [])

  const push = useCallback((message, type = 'info', ms = 3800) => {
    const id = ++_id
    setToasts((list) => [...list, { id, message, type }])
    if (ms) setTimeout(() => dismiss(id), ms)
    return id
  }, [dismiss])

  const toast = useCallback(Object.assign(
    (m, t) => push(m, t),
    {
      success: (m) => push(m, 'success'),
      error: (m) => push(m, 'error', 5000),
      info: (m) => push(m, 'info'),
    },
  ), [push])

  useEffect(() => {
    const onWake = (e) => setWaking(!!e.detail)
    window.addEventListener('api:waking', onWake)
    return () => window.removeEventListener('api:waking', onWake)
  }, [])

  return (
    <ToastCtx.Provider value={{ toast }}>
      {children}
      <div style={s.container}>
        {waking && (
          <div style={{ ...s.toast, ...s.waking }}>
            <span style={s.spinner}>⏳</span>
            Despertando el servidor… puede tardar unos segundos
          </div>
        )}
        {toasts.map((t) => (
          <div
            key={t.id}
            style={{ ...s.toast, ...s[t.type] }}
            onClick={() => dismiss(t.id)}
            role="status"
          >
            {ICON[t.type]} {t.message}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  )
}

const ICON = { success: '✓', error: '⚠', info: 'ⓘ' }

const s = {
  container: {
    position: 'fixed', bottom: 20, right: 20, zIndex: 9999,
    display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'flex-end',
    pointerEvents: 'none', maxWidth: 'min(92vw, 380px)',
  },
  toast: {
    pointerEvents: 'auto', cursor: 'pointer',
    background: 'var(--surface-3, #1d2027)', color: 'var(--text, #fff)',
    border: '1px solid var(--border)', borderLeftWidth: 3,
    borderRadius: 'var(--r-sm, 10px)', padding: '11px 16px',
    fontSize: 13.5, fontFamily: 'var(--font-ui)', lineHeight: 1.4,
    boxShadow: '0 12px 30px -12px rgba(0,0,0,0.6)',
    animation: 'toastIn 180ms ease-out',
  },
  success: { borderLeftColor: 'var(--menta)' },
  error: { borderLeftColor: 'var(--coral)' },
  info: { borderLeftColor: 'var(--cielo)' },
  waking: { borderLeftColor: 'var(--cielo)', background: 'rgba(111,168,255,0.12)' },
  spinner: { marginRight: 4 },
}
