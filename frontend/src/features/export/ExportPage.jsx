import { useState } from 'react'
import { exportApi } from '../../lib/api'

const CURRENT_YEAR = new Date().getFullYear()
const YEAR_OPTIONS = [CURRENT_YEAR, CURRENT_YEAR - 1, CURRENT_YEAR - 2, CURRENT_YEAR - 3]
const QUARTERS = [
  { q: 1, label: 'T1', sub: 'ene–mar' },
  { q: 2, label: 'T2', sub: 'abr–jun' },
  { q: 3, label: 'T3', sub: 'jul–sep' },
  { q: 4, label: 'T4', sub: 'oct–dic' },
]

export default function ExportPage() {
  const today = new Date().toISOString().split('T')[0]
  const firstDay = new Date(CURRENT_YEAR, 0, 1).toISOString().split('T')[0]

  // Modo trimestres
  const [years, setYears] = useState([CURRENT_YEAR])      // año actual marcado
  const [quarters, setQuarters] = useState([])
  const [loadingQ, setLoadingQ] = useState(false)

  // Modo rango
  const [from, setFrom] = useState(firstDay)
  const [to, setTo] = useState(today)
  const [loadingR, setLoadingR] = useState(false)

  const [error, setError] = useState('')

  const toggle = (list, setList, value) =>
    setList(list.includes(value) ? list.filter((x) => x !== value) : [...list, value])

  const exportQuarters = async () => {
    setError('')
    if (!years.length || !quarters.length) {
      setError('Selecciona al menos un año y un trimestre')
      return
    }
    setLoadingQ(true)
    try {
      await exportApi.downloadQuarters(years, quarters)
    } catch (e) {
      setError(e.message || 'No se pudo exportar')
    } finally {
      setLoadingQ(false)
    }
  }

  const exportRange = async () => {
    setError('')
    setLoadingR(true)
    try {
      await exportApi.download(from, to)
    } catch (e) {
      setError(e.message || 'No se pudo exportar')
    } finally {
      setLoadingR(false)
    }
  }

  return (
    <div style={{ maxWidth: 520 }}>
      <h1 style={s.title}>Exportar</h1>
      <p style={s.subtitle}>
        Descarga un ZIP con los justificantes de gastos, PDFs de facturas y un CSV
        resumen del periodo seleccionado.
      </p>

      {error && <div style={s.error}>{error}</div>}

      {/* Por trimestres */}
      <div style={s.card}>
        <div style={s.sectionTitle}>Por trimestres</div>

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

        <label style={{ ...s.label, marginTop: 18 }}>Trimestres</label>
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

        <button onClick={exportQuarters} style={s.btn} disabled={loadingQ}>
          {loadingQ ? 'Preparando ZIP…' : '⬇ Descargar trimestres'}
        </button>
        <div style={s.hint}>
          Puedes marcar varios años y trimestres. Las facturas se incluyen según su
          <strong> fecha de emisión</strong>.
        </div>
      </div>

      {/* Por rango de fechas */}
      <div style={s.card}>
        <div style={s.sectionTitle}>Por rango de fechas</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <div>
            <label style={s.label}>Desde</label>
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} style={s.input} />
          </div>
          <div>
            <label style={s.label}>Hasta</label>
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} style={s.input} />
          </div>
        </div>
        <button onClick={exportRange} style={s.btnSecondary} disabled={loadingR || !from || !to}>
          {loadingR ? 'Preparando ZIP…' : '⬇ Descargar rango'}
        </button>
      </div>

      <div style={s.hint}>
        El ZIP incluye: <strong>resumen.csv</strong>, carpeta <strong>gastos/</strong> con adjuntos y carpeta <strong>facturas/</strong> con los PDFs.
      </div>
    </div>
  )
}

const s = {
  title: { fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 22, margin: '0 0 6px', letterSpacing: '-0.01em' },
  subtitle: { fontSize: 14, color: 'var(--text-muted)', margin: '0 0 24px', lineHeight: 1.6 },
  error: { color: 'var(--coral)', fontSize: 13, marginBottom: 14, padding: '10px 14px', border: '1px solid rgba(240,135,106,0.3)', borderRadius: 'var(--r-sm)', background: 'var(--surface)' },
  card: { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-card)', padding: '22px', marginBottom: 14 },
  sectionTitle: { fontSize: 12, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 16 },
  label: { display: 'block', fontSize: 12, fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 9 },
  chipRow: { display: 'flex', gap: 8, flexWrap: 'wrap' },
  chip: { background: 'var(--surface-3)', border: '1px solid var(--border)', color: 'var(--text)', borderRadius: 'var(--r-sm)', padding: '8px 14px', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-ui)' },
  chipActive: { background: 'rgba(69,212,155,0.14)', border: '1px solid rgba(69,212,155,0.4)', color: 'var(--menta)', borderRadius: 'var(--r-sm)', padding: '8px 14px', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-ui)' },
  input: { width: '100%', background: 'var(--surface-3)', border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', padding: '10px 14px', color: 'var(--text)', fontFamily: 'var(--font-ui)', fontSize: 14, outline: 'none', boxSizing: 'border-box' },
  btn: { display: 'block', width: '100%', marginTop: 20, padding: '12px', background: 'var(--menta)', color: 'var(--ink)', border: 'none', borderRadius: 'var(--r-sm)', fontFamily: 'var(--font-ui)', fontSize: 14, fontWeight: 600, cursor: 'pointer' },
  btnSecondary: { display: 'block', width: '100%', marginTop: 18, padding: '12px', background: 'var(--btn-soft)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', fontFamily: 'var(--font-ui)', fontSize: 14, fontWeight: 600, cursor: 'pointer' },
  hint: { fontSize: 12, color: 'var(--text-muted)', marginTop: 14, lineHeight: 1.6 },
}
