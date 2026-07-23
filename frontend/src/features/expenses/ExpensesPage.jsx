import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { expensesApi } from '../../lib/api'
import { eur0, fmtDate } from '../../lib/format'
import { useToast } from '../../components/Toast'
import Pagination from '../../components/Pagination'

const EMPTY_FILTERS = { from_date: '', to_date: '', category: '' }
const PAGE_SIZE = 15

export default function ExpensesPage() {
  const { toast } = useToast()
  const [expenses, setExpenses] = useState([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState(EMPTY_FILTERS)
  const [categories, setCategories] = useState([])
  const [page, setPage] = useState(1)

  useEffect(() => {
    expensesApi.categories().then(setCategories)
  }, [])

  useEffect(() => {
    setLoading(true)
    setPage(1)
    const params = Object.fromEntries(
      Object.entries(filters).filter(([, v]) => v !== '')
    )
    expensesApi.list(params).then(setExpenses).finally(() => setLoading(false))
  }, [filters])

  const setFilter = (key, value) => setFilters((prev) => ({ ...prev, [key]: value }))
  const clearFilters = () => setFilters(EMPTY_FILTERS)
  const hasFilters = Object.values(filters).some(Boolean)

  const total = expenses.reduce((sum, e) => sum + e.amount, 0)
  const pageCount = Math.ceil(expenses.length / PAGE_SIZE)
  const pageItems = expenses.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const remove = async (id) => {
    if (!confirm('¿Eliminar este gasto?')) return
    try {
      await expensesApi.delete(id)
      setExpenses((prev) => prev.filter((e) => e.id !== id))
      toast.success('Gasto eliminado')
    } catch (e) {
      toast.error(e.message || 'No se pudo eliminar')
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <h1 style={s.title}>Gastos</h1>
        <Link to="/expenses/new" style={s.btnPrimary}>+ Nuevo gasto</Link>
      </div>

      {/* Filtros */}
      <div style={s.filterBar}>
        <input
          type="date"
          value={filters.from_date}
          onChange={(e) => setFilter('from_date', e.target.value)}
          style={s.filterInput}
          title="Desde"
        />
        <input
          type="date"
          value={filters.to_date}
          onChange={(e) => setFilter('to_date', e.target.value)}
          style={s.filterInput}
          title="Hasta"
        />
        <select
          value={filters.category}
          onChange={(e) => setFilter('category', e.target.value)}
          style={{ ...s.filterInput, color: filters.category ? 'var(--text)' : 'var(--text-muted)' }}
        >
          <option value="">Todas las categorías</option>
          {categories.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        {hasFilters && (
          <button onClick={clearFilters} style={s.clearBtn}>Limpiar</button>
        )}
      </div>

      {loading ? (
        <div style={{ color: 'var(--text-muted)', fontSize: 14 }}>Cargando…</div>
      ) : expenses.length === 0 ? (
        hasFilters ? (
          <div style={s.emptyFiltered}>
            <div style={{ fontSize: 14, color: 'var(--text-muted)' }}>Sin resultados para estos filtros.</div>
          </div>
        ) : (
          <EmptyState />
        )
      ) : (
        <>
          <div style={s.card}>
            {pageItems.map((exp, i) => (
              <div key={exp.id} style={{ ...s.row, ...(i < pageItems.length - 1 ? s.rowBorder : {}) }}>
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

          <Pagination page={page} pageCount={pageCount} onPage={setPage} />

          <div style={s.summary}>
            <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>
              {expenses.length} {expenses.length === 1 ? 'gasto' : 'gastos'}
              {hasFilters ? ' en el período' : ''}
            </span>
            <span style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 15, color: 'var(--coral)', fontVariantNumeric: 'tabular-nums' }}>
              −{eur0(total)}
            </span>
          </div>
        </>
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
  btnPrimary: { display: 'inline-block', padding: '9px 18px', background: 'var(--menta)', color: 'var(--ink)', borderRadius: 'var(--r-sm)', fontWeight: 600, fontSize: 14, textDecoration: 'none', flex: 'none' },
  card: { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-card)', padding: '0 20px' },
  row: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 0' },
  rowBorder: { borderBottom: '1px solid var(--border-soft)' },
  dot: { width: 8, height: 8, borderRadius: 99, flexShrink: 0 },
  delBtn: { background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 14, padding: '2px 4px', borderRadius: 4 },
  filterBar: {
    display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16,
    background: 'var(--surface)', border: '1px solid var(--border)',
    borderRadius: 'var(--r-card)', padding: '12px 16px',
  },
  filterInput: {
    background: 'var(--ink)', border: '1px solid var(--border)', borderRadius: 'var(--r-sm)',
    color: 'var(--text)', fontSize: 13, padding: '6px 10px', outline: 'none',
    colorScheme: 'dark',
  },
  clearBtn: {
    background: 'none', border: '1px solid var(--border)', borderRadius: 'var(--r-sm)',
    color: 'var(--text-muted)', fontSize: 13, padding: '6px 12px', cursor: 'pointer',
  },
  summary: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '10px 4px', marginTop: 8,
  },
  emptyFiltered: {
    background: 'var(--surface)', border: '1px solid var(--border)',
    borderRadius: 'var(--r-card)', padding: '32px 24px', textAlign: 'center',
  },
}
