const _fmt = (decimals) => (n) => {
  if (n == null || isNaN(n)) return '—'
  return n.toLocaleString('es-ES', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
    // 'always': fuerza el punto de miles también en 4 cifras (es-ES no lo pone
    // por defecto por debajo de 10.000). Así 1.234,50 en vez de 1234,50.
    useGrouping: 'always',
  })
}

export const fmt0 = _fmt(0)
export const fmt2 = _fmt(2)

export const eur0 = (n) => `${fmt0(n)} €`
export const eur2 = (n) => `${fmt2(n)} €`

/**
 * Fecha local en formato YYYY-MM-DD (para inputs type=date).
 *
 * OJO: NO usar `new Date().toISOString().split('T')[0]`. toISOString() pasa a
 * UTC, así que en España (UTC+1/+2) la medianoche local cae en el día anterior:
 * `new Date(2026, 0, 1)` acababa dando "2025-12-31".
 */
const pad = (n) => String(n).padStart(2, '0')
export const toISODate = (d = new Date()) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

export const fmtDate = (d) => {
  if (!d) return '—'
  const date = typeof d === 'string' ? new Date(d + 'T00:00:00') : d
  return date.toLocaleDateString('es-ES', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

export const fmtDateShort = (d) => {
  if (!d) return '—'
  const date = typeof d === 'string' ? new Date(d + 'T00:00:00') : d
  return date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })
}
