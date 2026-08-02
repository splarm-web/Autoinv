/**
 * Iconos de la interfaz.
 *
 * Todos miden `1.15em`, así que **escalan con el texto que los acompaña**: un
 * botón de 13px y otro de 15px tienen el icono proporcionado sin tocar nada.
 * Antes eran caracteres sueltos (✓, ⬇, ✕) que se veían pequeños y desalineados
 * porque cada fuente los dibuja a su manera.
 *
 * `viewBox` de 24 en todos y trazo de 2: mismo grosor óptico en todo el set.
 */

function Svg({ children, ...rest }) {
  return (
    <svg
      viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      width="1.15em" height="1.15em" aria-hidden="true"
      style={{ flexShrink: 0 }} {...rest}
    >
      {children}
    </svg>
  )
}

export const IconPlus = (p) => <Svg {...p}><path d="M12 5v14M5 12h14" /></Svg>

export const IconCheck = (p) => <Svg {...p}><path d="M20 6L9 17l-5-5" /></Svg>

export const IconTrash = (p) => (
  <Svg {...p}>
    <path d="M3 6h18M8 6V4a1 1 0 011-1h6a1 1 0 011 1v2M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
    <path d="M10 11v6M14 11v6" />
  </Svg>
)

export const IconEdit = (p) => (
  <Svg {...p}>
    <path d="M17 3a2.8 2.8 0 014 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
  </Svg>
)

export const IconDownload = (p) => (
  <Svg {...p}><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" /></Svg>
)

export const IconMail = (p) => (
  <Svg {...p}>
    <rect x="2" y="4" width="20" height="16" rx="2" />
    <path d="M22 6l-10 7L2 6" />
  </Svg>
)

export const IconSend = (p) => (
  <Svg {...p}><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" /></Svg>
)

export const IconRefresh = (p) => (
  <Svg {...p}>
    <path d="M21 12a9 9 0 11-3-6.7M21 3v6h-6" />
  </Svg>
)

export const IconEye = (p) => (
  <Svg {...p}>
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
    <circle cx="12" cy="12" r="3" />
  </Svg>
)

export const IconX = (p) => <Svg {...p}><path d="M18 6L6 18M6 6l12 12" /></Svg>

export const IconSliders = (p) => (
  <Svg {...p}>
    <path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3" />
    <path d="M1 14h6M9 8h6M17 16h6" />
  </Svg>
)

export const IconFile = (p) => (
  <Svg {...p}>
    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z" />
    <path d="M14 2v6h6" />
  </Svg>
)

export const IconAlert = (p) => (
  <Svg {...p}>
    <path d="M10.3 3.9L1.8 18a2 2 0 001.7 3h17a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z" />
    <path d="M12 9v4M12 17h.01" />
  </Svg>
)

export const IconStethoscope = (p) => (
  <Svg {...p}>
    <path d="M4 3v6a5 5 0 0010 0V3" />
    <path d="M4 3H2M14 3h-2" />
    <path d="M9 14v2a5 5 0 0010 0v-1" />
    <circle cx="19" cy="12" r="2" />
  </Svg>
)
