/**
 * Paginación simple (cliente). Se oculta sola si solo hay una página.
 *
 * Props: page (1-based), pageCount, onPage(nextPage)
 */
export default function Pagination({ page, pageCount, onPage }) {
  if (pageCount <= 1) return null
  return (
    <div style={s.wrap}>
      <button style={s.btn} onClick={() => onPage(page - 1)} disabled={page <= 1} title="Anterior">‹</button>
      <span style={s.info}>{page} / {pageCount}</span>
      <button style={s.btn} onClick={() => onPage(page + 1)} disabled={page >= pageCount} title="Siguiente">›</button>
    </div>
  )
}

const s = {
  wrap: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, marginTop: 16 },
  btn: {
    background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)',
    borderRadius: 'var(--r-sm)', width: 34, height: 34, cursor: 'pointer', fontSize: 18,
    lineHeight: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  },
  info: { fontSize: 13, color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums', minWidth: 44, textAlign: 'center' },
}
