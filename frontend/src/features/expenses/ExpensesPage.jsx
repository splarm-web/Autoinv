import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { expensesApi } from '../../lib/api'
import { eur0, fmtDate } from '../../lib/format'

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    expensesApi.list().then(setExpenses).finally(() => setLoading(false))
  }, [])

  const remove = async (id) => {
    if (!confirm('¿Eliminar este gasto?')) return
    await expensesApi.delete(id)
    setExpenses((prev) => prev.filter((e) => e.id !== id))
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <h1 style={s.title}>Gastos</h1>
        <Link to="/expenses/new" style={s.btnPrimary}>+ Nuevo gasto</Link>
      </div>

      {loading ? (
        <div style={{ color: 'var(--text-muted)', fontSize: 14 }}>Cargando…</div>
      ) : expenses.length === 0 ? (
        <EmptyState />
      ) : (
        <div style={s.card}>
          {expenses.map((exp, i) => (
            <div key={exp.id} style={{ ...s.row, ...(i < expenses.length - 1 ? s.rowBorder : {}) }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 13 }}>
                <span style={{ ...s.dot, background: 'var(--coral)' }} />
                <div>
                  <div style={{ fontSize: 14, fontWeight: 500 }}>{exp.concept || exp.supplier || 'Gasto'}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 1 }}>
                    {fmtDate(exp.date)} · {exp.category || 'Sin categoría'}
                    {exp.supplier ? ` · ${exp.supplier}` : ''}
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <span style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 15, color: 'var(--coral)', fontVariantNumeric: 'tabular-nums' }}>
                  −{eur0(exp.amount)}
                </span>
                <button onClick={() => remove(exp.id)} style={s.delBtn} title="Eliminar">✕</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function EmptyState() {
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-card)', padding: '48px 24px', textAlign: 'center' }}>
      <div style={{ fontSize: 32, marginBottom: 12 }}>🧾</div>
      <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>Sin gastos todavía</div>
      <div style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 20 }}>Añade tu primer gasto de forma manual o sube una foto de tu ticket.</div>
      <Link to="/expenses/new" style={s.btnPrimary}>+ Añadir primer gasto</Link>
    </div>
  )
}

const s = {
  title: { fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 22, margin: 0, letterSpacing: '-0.01em' },
  btnPrimary: { display: 'inline-block', padding: '9px 18px', background: 'var(--menta)', color: 'var(--ink)', borderRadius: 'var(--r-sm)', fontWeight: 600, fontSize: 14, textDecoration: 'none' },
  card: { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-card)', padding: '0 20px' },
  row: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 0' },
  rowBorder: { borderBottom: '1px solid var(--border-soft)' },
  dot: { width: 8, height: 8, borderRadius: 99, flexShrink: 0 },
  delBtn: { background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 14, padding: '2px 4px', borderRadius: 4 },
}
