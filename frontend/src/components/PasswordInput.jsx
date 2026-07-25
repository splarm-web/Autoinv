import { useState } from 'react'

/**
 * Input de contraseña con botón de ojo para mostrar/ocultar.
 *
 * Sirve tanto para las pantallas de auth (estilo por clase CSS `.field input`)
 * como para formularios con estilos inline (Ajustes/Admin): acepta `className`
 * y/o `style` para el input y deja hueco a la derecha para el ojo.
 */
export default function PasswordInput({
  className,
  style,
  wrapperStyle,
  autoComplete = 'current-password',
  ...props
}) {
  const [show, setShow] = useState(false)
  return (
    <div style={{ position: 'relative', display: 'block', ...wrapperStyle }}>
      <input
        {...props}
        type={show ? 'text' : 'password'}
        autoComplete={autoComplete}
        className={className}
        style={{ width: '100%', ...style, paddingRight: 42 }}
      />
      <button
        type="button"
        onClick={() => setShow((v) => !v)}
        title={show ? 'Ocultar contraseña' : 'Mostrar contraseña'}
        aria-label={show ? 'Ocultar contraseña' : 'Mostrar contraseña'}
        style={eyeStyle}
        tabIndex={-1}
      >
        {show ? <IconEyeOff /> : <IconEye />}
      </button>
    </div>
  )
}

const eyeStyle = {
  position: 'absolute',
  right: 8,
  top: '50%',
  transform: 'translateY(-50%)',
  background: 'none',
  border: 'none',
  padding: 6,
  cursor: 'pointer',
  color: 'var(--text-muted)',
  display: 'flex',
  alignItems: 'center',
}

function IconEye() {
  return (
    <svg width="17" height="17" viewBox="0 0 17 17" fill="none">
      <path d="M1 8.5S3.7 3.5 8.5 3.5 16 8.5 16 8.5 13.3 13.5 8.5 13.5 1 8.5 1 8.5Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
      <circle cx="8.5" cy="8.5" r="2.2" stroke="currentColor" strokeWidth="1.3" />
    </svg>
  )
}
function IconEyeOff() {
  return (
    <svg width="17" height="17" viewBox="0 0 17 17" fill="none">
      <path d="M6.3 4A7.8 7.8 0 0 1 8.5 3.5C13.3 3.5 16 8.5 16 8.5a13 13 0 0 1-2 2.6M4 5.4A13 13 0 0 0 1 8.5S3.7 13.5 8.5 13.5c.9 0 1.7-.15 2.4-.4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M7 7a2.2 2.2 0 0 0 3 3M2 2l13 13" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  )
}
