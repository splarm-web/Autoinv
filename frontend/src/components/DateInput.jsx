/**
 * DateInput — <input type="date"> con apariencia 100% propia.
 *
 * Ocultar solo el icono nativo (vía ::-webkit-calendar-picker-indicator) es
 * frágil: Safari no usa ese icono, dibuja sus propios controles (flechas de
 * paso por día/mes/año) que no hay forma de apagar por CSS, y acaban
 * solapando con cualquier icono propio que se dibuje encima.
 *
 * La solución robusta: el <input> real queda invisible pero ocupa todo el
 * hueco y sigue recibiendo el toque (abre el selector nativo del sistema);
 * debajo se dibuja el texto formateado + el icono de calendario propios, que
 * no dependen de lo que decida pintar cada navegador.
 */
export default function DateInput({ value, onChange, style, ...rest }) {
  return (
    <div className="date-wrap">
      <input type="date" value={value} onChange={onChange} className="date-native" {...rest} />
      <div className="date-display" style={style}>
        {value ? formatDisplay(value) : <span className="date-placeholder">dd/mm/aaaa</span>}
      </div>
    </div>
  )
}

function formatDisplay(iso) {
  const [y, m, d] = (iso || '').split('-')
  if (!y || !m || !d) return ''
  return `${d}/${m}/${y}`
}
