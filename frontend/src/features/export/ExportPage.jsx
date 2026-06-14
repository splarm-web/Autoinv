import { useState } from 'react'
import { exportApi } from '../../lib/api'

export default function ExportPage() {
  const today = new Date().toISOString().split('T')[0]
  const firstDay = new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0]

  const [from, setFrom] = useState(firstDay)
  const [to, setTo] = useState(today)
  const [loading, setLoading] = useState(false)

  const download = async () => {
    setLoading(true)
    try {
      exportApi.download(from, to)
    } finally {
      setTimeout(() => setLoading(false), 1500)
    }
  }

  return (
    <div style={{ maxWidth: 480 }}>
      <h1 style={s.title}>Exportar</h1>
      <p style={s.subtitle}>
        Descarga un ZIP con los justificantes de gastos, PDFs de facturas y un CSV
        resumen para el periodo seleccionado.
      </p>

      <div style={s.card}>
        <div style={s.sectionTitle}>Rango de fechas</div>
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

        <button onClick={download} style={s.btn} disabled={loading || !from || !to}>
          {loading ? 'Preparando ZIP…' : '⬇ Descargar ZIP'}
        </button>

        <div style={s.hint}>
          El ZIP incluirá: <strong>resumen.csv</strong>, carpeta <strong>gastos/</strong> con adjuntos y carpeta <strong>facturas/</strong> con PDFs.
        </div>
      </div>
    </div>
  )
}

const s = {
  title: { fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 22, margin: '0 0 6px', letterSpacing: '-0.01em' },
  subtitle: { fontSize: 14, color: 'var(--text-muted)', margin: '0 0 24px', lineHeight: 1.6 },
  card: { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-card)', padding: '22px' },
  sectionTitle: { fontSize: 12, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 16 },
  label: { display: 'block', fontSize: 12, fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 7 },
  input: { width: '100%', background: 'var(--surface-3)', border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', padding: '10px 14px', color: 'var(--text)', fontFamily: 'var(--font-ui)', fontSize: 14, outline: 'none' },
  btn: { display: 'block', width: '100%', marginTop: 18, padding: '12px', background: 'var(--menta)', color: 'var(--ink)', border: 'none', borderRadius: 'var(--r-sm)', fontFamily: 'var(--font-ui)', fontSize: 14, fontWeight: 600, cursor: 'pointer' },
  hint: { fontSize: 12, color: 'var(--text-muted)', marginTop: 14, lineHeight: 1.6 },
}
