import { useState } from 'react'
import { exportApi } from '../../lib/api'
import { toISODate } from '../../lib/format'
import { useToast } from '../../components/Toast'
import '../../styles/modal.css'

const CURRENT_YEAR = new Date().getFullYear()
const YEAR_OPTIONS = [CURRENT_YEAR, CURRENT_YEAR - 1, CURRENT_YEAR - 2, CURRENT_YEAR - 3]
const QUARTERS = [
  { q: 1, label: 'T1', sub: 'ene–mar' },
  { q: 2, label: 'T2', sub: 'abr–jun' },
  { q: 3, label: 'T3', sub: 'jul–sep' },
  { q: 4, label: 'T4', sub: 'oct–dic' },
]

// Qué exporta cada ámbito. La UI es la misma; cambian título y contenido.
const SCOPES = {
  facturas: {
    title: 'Exportar facturas',
    contenido: <>Incluye <strong>facturas/</strong> con los PDFs y <strong>resumen.csv</strong> de tus ingresos.</>,
  },
  gastos: {
    title: 'Exportar gastos',
    contenido: <>Incluye <strong>gastos/</strong> con los justificantes que subiste y <strong>resumen.csv</strong>.</>,
  },
  todo: {
    title: 'Exportar ingresos y gastos',
    contenido: <>Incluye <strong>facturas/</strong> con los PDFs, <strong>gastos/</strong> con los justificantes y <strong>resumen.csv</strong>.</>,
  },
}

/**
 * Modal de exportación. Sustituye a la antigua página /export: exportar es una
 * acción puntual, no una sección, así que vive donde están los datos.
 * Dos modos en pestañas: por trimestres (lo habitual) y por rango de fechas.
 *
 * `scope`: 'facturas' (desde Facturas) | 'gastos' (desde Gastos) | 'todo' (dashboard)
 */
export default function ExportModal({ onClose, scope = 'todo' }) {
  const cfg = SCOPES[scope] ?? SCOPES.todo
  const { toast } = useToast()
  const today = toISODate()
  const firstDay = `${CURRENT_YEAR}-01-01`

  const [tab, setTab] = useState('trimestres')   // 'trimestres' | 'rango'

  const [years, setYears] = useState([CURRENT_YEAR])
  const [quarters, setQuarters] = useState([])
  const [from, setFrom] = useState(firstDay)
  const [to, setTo] = useState(today)
  const [loading, setLoading] = useState(false)

  const toggle = (list, setList, value) =>
    setList(list.includes(value) ? list.filter((x) => x !== value) : [...list, value])

  const run = async (fn, okMsg) => {
    setLoading(true)
    try {
      await fn()
      toast.success(okMsg)
      onClose()
    } catch (e) {
      toast.error(e.message || 'No se pudo exportar')
    } finally {
      setLoading(false)
    }
  }

  const exportQuarters = () => {
    if (!years.length || !quarters.length) {
      toast.error('Selecciona al menos un año y un trimestre')
      return
    }
    run(() => exportApi.downloadQuarters(years, quarters, scope), 'ZIP descargado')
  }

  const exportRange = () => run(() => exportApi.download(from, to, scope), 'ZIP descargado')

  return (
    <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-panel">
        <div className="modal-header">
          <h2 className="modal-title">{cfg.title}</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="modal-tabs">
          <button
            className={'modal-tab' + (tab === 'trimestres' ? ' active' : '')}
            onClick={() => setTab('trimestres')}
          >
            Por trimestres
          </button>
          <button
            className={'modal-tab' + (tab === 'rango' ? ' active' : '')}
            onClick={() => setTab('rango')}
          >
            Por rango de fechas
          </button>
        </div>

        <div className="modal-form">
          {tab === 'trimestres' ? (
            <>
              <div>
                <label style={s.label}>Años</label>
                <div style={s.chipRow}>
                  {YEAR_OPTIONS.map((y) => (
                    <button
                      key={y}
                      onClick={() => toggle(years, setYears, y)}
                      style={years.includes(y) ? s.chipActive : s.chip}
                    >
                      {y}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label style={s.label}>Trimestres</label>
                <div style={s.chipRow}>
                  {QUARTERS.map(({ q, label, sub }) => (
                    <button
                      key={q}
                      onClick={() => toggle(quarters, setQuarters, q)}
                      style={quarters.includes(q) ? s.chipActive : s.chip}
                      title={sub}
                    >
                      {label} <span style={{ opacity: 0.6, fontWeight: 400, fontSize: 11 }}>{sub}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div style={s.hint}>
                Puedes marcar varios años y trimestres. Las facturas se incluyen según su
                <strong> fecha de emisión</strong>.
              </div>

              <div className="modal-footer">
                <button onClick={onClose} style={s.btnGhost}>Cancelar</button>
                <button onClick={exportQuarters} style={s.btn} disabled={loading}>
                  {loading ? 'Preparando ZIP…' : '⬇ Descargar'}
                </button>
              </div>
            </>
          ) : (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={s.label}>Desde</label>
                  <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} style={s.input} />
                </div>
                <div>
                  <label style={s.label}>Hasta</label>
                  <input type="date" value={to} onChange={(e) => setTo(e.target.value)} style={s.input} />
                </div>
              </div>

              <div style={s.hint}>
                Incluye todo lo que caiga entre las dos fechas (ambas incluidas).
              </div>

              <div className="modal-footer">
                <button onClick={onClose} style={s.btnGhost}>Cancelar</button>
                <button onClick={exportRange} style={s.btn} disabled={loading || !from || !to}>
                  {loading ? 'Preparando ZIP…' : '⬇ Descargar'}
                </button>
              </div>
            </>
          )}

          <div style={{ ...s.hint, borderTop: '1px solid var(--border-soft)', paddingTop: 12 }}>
            {cfg.contenido}
          </div>
        </div>
      </div>
    </div>
  )
}

const s = {
  label: { display: 'block', fontSize: 12, fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 9 },
  chipRow: { display: 'flex', gap: 8, flexWrap: 'wrap' },
  chip: { background: 'var(--surface-3)', border: '1px solid var(--border)', color: 'var(--text)', borderRadius: 'var(--r-sm)', padding: '8px 14px', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-ui)' },
  chipActive: { background: 'var(--menta-tint)', border: '1px solid var(--menta)', color: 'var(--menta)', borderRadius: 'var(--r-sm)', padding: '8px 14px', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-ui)' },
  input: { width: '100%', background: 'var(--surface-3)', border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', padding: '10px 14px', color: 'var(--text)', fontFamily: 'var(--font-ui)', fontSize: 14, outline: 'none', boxSizing: 'border-box' },
  btn: { padding: '10px 20px', background: 'var(--menta)', color: 'var(--ink)', border: 'none', borderRadius: 'var(--r-sm)', fontFamily: 'var(--font-ui)', fontSize: 14, fontWeight: 600, cursor: 'pointer' },
  btnGhost: { padding: '10px 18px', background: 'transparent', color: 'var(--text-muted)', border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', fontFamily: 'var(--font-ui)', fontSize: 14, cursor: 'pointer' },
  hint: { fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6 },
}
