import { useState } from 'react'
import { Link } from 'react-router-dom'
import { IconPlus } from './Icons'

/**
 * Botón flotante para crear cosas, solo en móvil.
 *
 * En escritorio hay sitio de sobra para botones normales en el flujo de la
 * página, así que allí no aparece (lo oculta `.fab-dial` / `.fab-add` en
 * responsive.css) y quien lo usa muestra sus botones de siempre.
 *
 * Con una sola opción es un enlace directo: desplegar un menú de un único
 * elemento sería un toque de más para nada. Con dos o más se despliega.
 */
export default function FabDial({ acciones, etiquetaUnica }) {
  const [abierto, setAbierto] = useState(false)
  if (!acciones?.length) return null

  if (acciones.length === 1) {
    const a = acciones[0]
    return (
      <Link to={a.to} className="fab-add btn btn-primary" aria-label={etiquetaUnica || a.label}>
        <span className="fab-icon"><IconPlus /></span>
        <span className="fab-label">{a.label}</span>
      </Link>
    )
  }

  return (
    <div className={'fab-dial' + (abierto ? ' open' : '')}>
      {/* Capa a pantalla completa para cerrar tocando fuera */}
      {abierto && <div className="fab-dial-backdrop" onClick={() => setAbierto(false)} />}
      <div className="fab-dial-options">
        {acciones.map((a) => (
          <Link key={a.to} to={a.to} className="fab-dial-option" onClick={() => setAbierto(false)}>
            <span className="fab-dial-option-label">{a.label}</span>
            <span className="fab-dial-option-icon"><IconPlus /></span>
          </Link>
        ))}
      </div>
      <button
        type="button"
        className="fab-dial-trigger"
        onClick={() => setAbierto((v) => !v)}
        aria-expanded={abierto}
        aria-label={abierto ? 'Cerrar opciones' : 'Crear'}
      >
        <span className="fab-dial-trigger-icon">{abierto ? '×' : '+'}</span>
      </button>
    </div>
  )
}
