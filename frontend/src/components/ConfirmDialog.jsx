import { useEffect, useRef } from 'react'
import { IconAlert } from './Icons'
import '../styles/modal.css'

/**
 * Confirmación para acciones que no se pueden deshacer.
 *
 * Sustituye a `window.confirm`, que en móvil aparece como un aviso del sistema
 * sin relación visual con la app, no dice qué se va a perder y el botón de
 * aceptar tiene el mismo peso que el de cancelar.
 *
 * El foco arranca en **Cancelar** a propósito: si alguien pulsa Intro por
 * inercia, no borra nada.
 */
export default function ConfirmDialog({
  titulo,
  mensaje,
  detalle,
  textoConfirmar = 'Eliminar',
  onConfirmar,
  onCancelar,
  cargando = false,
}) {
  const cancelarRef = useRef(null)

  useEffect(() => {
    cancelarRef.current?.focus()
    const alPulsar = (e) => { if (e.key === 'Escape') onCancelar() }
    window.addEventListener('keydown', alPulsar)
    return () => window.removeEventListener('keydown', alPulsar)
  }, [onCancelar])

  return (
    <div
      className="modal-backdrop"
      onClick={(e) => e.target === e.currentTarget && onCancelar()}
      role="alertdialog"
      aria-modal="true"
    >
      <div className="modal-panel confirm-panel">
        <div className="confirm-body">
          <span className="confirm-icono"><IconAlert /></span>
          <div style={{ minWidth: 0 }}>
            <h2 className="confirm-titulo">{titulo}</h2>
            <p className="confirm-mensaje">{mensaje}</p>
            {detalle && <p className="confirm-detalle">{detalle}</p>}
          </div>
        </div>
        <div className="confirm-acciones">
          <button ref={cancelarRef} className="btn btn-neutral" onClick={onCancelar} disabled={cargando}>
            Cancelar
          </button>
          <button className="btn btn-danger-solid" onClick={onConfirmar} disabled={cargando}>
            {cargando ? 'Eliminando…' : textoConfirmar}
          </button>
        </div>
      </div>
    </div>
  )
}
