import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { invoicesApi } from '../../lib/api'
import { eur2, fmtDate } from '../../lib/format'

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState([])
  const [loading, setLoading] = useState(true)
  const [downloading, setDownloading] = useState(null)

  useEffect(() => {
    invoicesApi.list().then(setInvoices).finally(() => setLoading(false))
  }, [])

  const remove = async (id) => {
    if (!confirm('¿Eliminar esta factura?')) return
    await invoicesApi.delete(id)
    setInvoices((prev) => prev.filter((i) => i.id !== id))
  }

  const download = async (inv) => {
    setDownloading(inv.id)
    try {
      await invoicesApi.downloadPdf(inv.id, inv.number)
    } catch (e) {
      alert(e.message || 'No se pudo descargar el PDF')
    } finally {
      setDownloading(null)
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, gap: 10, flexWrap: 'wrap' }}>
        <h1 style={s.title}>Facturas</h1>
        <div style={{ display: 'flex', gap: 10 }}>
          <Link to="/invoices/transporte" style={s.btnSecondary}>+ Factura de transporte</Link>
          <Link to="/invoices/new" style={s.btnPrimary}>+ Nueva factura</Link>
        </div>
      </div>

      {loading ? (
        <div style={{ color: 'var(--text-muted)', fontSize: 14 }}>Cargando…</div>
      ) : invoices.length === 0 ? (
        <EmptyState />
      ) : (
        <div style={s.card}>
          {invoices.map((inv, i) => (
            <div key={inv.id} style={{ ...s.row, ...(i < invoices.length - 1 ? s.rowBorder : {}) }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 13 }}>
                <span style={{ ...s.dot, background: 'var(--menta)' }} />
                <div>
                  <div style={{ fontSize: 14, fontWeight: 500 }}>Factura {inv.number} · {inv.client_name}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 1 }}>
                    {fmtDate(inv.date)}
                    {inv.due_date ? ` · Vence ${fmtDate(inv.due_date)}` : ''}
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 15, color: 'var(--menta)', fontVariantNumeric: 'tabular-nums' }}>
                  +{eur2(inv.total)}
                </span>
                <button
                  onClick={() => download(inv)}
                  disabled={downloading === inv.id}
                  style={s.pdfBtn}
                  title="Descargar PDF"
                >
                  {downloading === inv.id ? '…' : 'PDF'}
                </button>
                <button onClick={() => remove(inv.id)} style={s.delBtn} title="Eliminar">✕</button>
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
      <div style={{ fontSize: 32, marginBottom: 12 }}>📄</div>
      <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>Sin facturas todavía</div>
      <div style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 20 }}>Crea tu primera factura y verás la vista previa antes de guardar.</div>
      <Link to="/invoices/new" style={{ display: 'inline-block', padding: '9px 18px', background: 'var(--menta)', color: 'var(--ink)', borderRadius: 'var(--r-sm)', fontWeight: 600, fontSize: 14, textDecoration: 'none' }}>+ Nueva factura</Link>
    </div>
  )
}

const s = {
  title: { fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 22, margin: 0, letterSpacing: '-0.01em' },
  btnPrimary: { display: 'inline-block', padding: '9px 18px', background: 'var(--menta)', color: 'var(--ink)', borderRadius: 'var(--r-sm)', fontWeight: 600, fontSize: 14, textDecoration: 'none' },
  btnSecondary: { display: 'inline-block', padding: '9px 18px', background: 'rgba(255,255,255,0.06)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', fontWeight: 600, fontSize: 14, textDecoration: 'none' },
  card: { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-card)', padding: '0 20px' },
  row: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 0' },
  rowBorder: { borderBottom: '1px solid var(--border-soft)' },
  dot: { width: 8, height: 8, borderRadius: 99, flexShrink: 0 },
  pdfBtn: { background: 'none', border: '1px solid var(--border)', color: 'var(--text)', cursor: 'pointer', fontSize: 12, fontWeight: 600, padding: '4px 10px', borderRadius: 'var(--r-sm)', letterSpacing: '0.02em' },
  delBtn: { background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 14, padding: '2px 4px', borderRadius: 4 },
}
