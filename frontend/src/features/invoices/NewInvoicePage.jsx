import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { clientsApi, invoicesApi } from '../../lib/api'
import { useAuth } from '../../app/AuthContext'
import { eur2, toISODate } from '../../lib/format'
import { useToast } from '../../components/Toast'
import InvoicePreview from './InvoicePreview'

const EMPTY_LINE = { description: '', quantity: 1, unit_price: '', vat_rate: 21 }

const EMPTY_FORM = {
  date: toISODate(),
  due_date: '',
  client_id: null,
  client_name: '',
  client_tax_id: '',
  client_address: '',
  payment_method: 'Transferencia · 30 días',
  irpf_rate: 15,
  lines: [{ ...EMPTY_LINE }],
}

export default function NewInvoicePage() {
  const { user } = useAuth()
  const { toast } = useToast()
  const navigate = useNavigate()
  const [form, setForm] = useState(EMPTY_FORM)
  const [clients, setClients] = useState([])
  const [showPreview, setShowPreview] = useState(false)
  const [saving, setSaving] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [attempted, setAttempted] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    clientsApi.list().then((list) => {
      setClients(list)
      const def = list.find((c) => c.is_default)
      if (def) applyClient(def)
    })
  }, [])

  const applyClient = (client) => {
    setForm((f) => ({
      ...f,
      client_id: client ? client.id : null,
      client_name: client ? client.nombre : '',
      client_tax_id: client ? (client.cif ?? '') : '',
      client_address: client
        ? [client.direccion, client.ciudad].filter(Boolean).join(', ')
        : '',
    }))
  }

  const handleClientSelect = (e) => {
    const id = e.target.value
    if (!id) { applyClient(null); return }
    const client = clients.find((c) => c.id === parseInt(id))
    if (client) applyClient(client)
  }

  const handle = (e) => {
    const { name, value } = e.target
    setForm((f) => ({ ...f, [name]: value }))
  }

  const handleLine = (i, e) => {
    const { name, value } = e.target
    const lines = [...form.lines]
    lines[i] = { ...lines[i], [name]: name === 'description' ? value : parseFloat(value) || 0 }
    setForm((f) => ({ ...f, lines }))
  }

  const addLine = () => setForm((f) => ({ ...f, lines: [...f.lines, { ...EMPTY_LINE }] }))
  const removeLine = (i) => setForm((f) => ({ ...f, lines: f.lines.filter((_, idx) => idx !== i) }))

  // Calcular totales en tiempo real
  const subtotal = form.lines.reduce((acc, l) => acc + (l.quantity || 0) * (l.unit_price || 0), 0)
  const vat_total = form.lines.reduce((acc, l) => acc + (l.quantity || 0) * (l.unit_price || 0) * ((l.vat_rate || 0) / 100), 0)
  const irpf_total = subtotal * ((parseFloat(form.irpf_rate) || 0) / 100)
  const total = subtotal + vat_total - irpf_total

  // Validación bloqueante (campos obligatorios) — mismo patrón que transporte
  const lineasValidas = form.lines.filter((l) => (l.description || '').trim() && parseFloat(l.unit_price) > 0)
  const invalid = {
    'Cliente': !form.client_name.trim(),
    'Fecha': !form.date,
    'Vencimiento': !form.due_date,
    'Al menos un concepto con importe': lineasValidas.length === 0,
  }
  const missing = Object.keys(invalid).filter((k) => invalid[k])
  const errStyle = (bad) => (attempted && bad ? s.inputError : null)

  const guard = () => {
    if (missing.length > 0) {
      setAttempted(true)
      setError(`Faltan campos obligatorios: ${missing.join(' · ')}`)
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return false
    }
    setError('')
    return true
  }

  const previewData = {
    issuer: { legal_name: user?.legal_name, nif: user?.nif, address: user?.address },
    client: { name: form.client_name, tax_id: form.client_tax_id, address: form.client_address },
    invoice: { number: '(preview)', date: form.date, due_date: form.due_date, payment_method: form.payment_method },
    lines: form.lines.map((l) => ({
      ...l,
      line_total: (l.quantity || 0) * (l.unit_price || 0),
    })),
    totals: {
      subtotal,
      vat_total,
      irpf_total,
      total,
      vat_rate: form.lines[0]?.vat_rate ?? 21,
      irpf_rate: parseFloat(form.irpf_rate) || 15,
    },
  }

  const createInvoice = () => invoicesApi.create({
    ...form,
    client_id: form.client_id ?? null,
    irpf_rate: parseFloat(form.irpf_rate),
    lines: form.lines.map((l) => ({
      ...l,
      quantity: parseFloat(l.quantity),
      unit_price: parseFloat(l.unit_price),
      vat_rate: parseFloat(l.vat_rate),
    })),
  })

  const submit = async (e) => {
    if (e) e.preventDefault()
    if (!guard()) return
    setSaving(true)
    try {
      await createInvoice()
      toast.success('Factura guardada')
      navigate('/invoices')
    } catch (err) {
      toast.error(err.message || 'No se pudo guardar')
    } finally {
      setSaving(false)
    }
  }

  const submitAndDownload = async () => {
    if (!guard()) return
    setDownloading(true)
    try {
      const created = await createInvoice()
      await invoicesApi.downloadPdf(created.id, created.number)
      toast.success('Factura guardada y PDF descargado')
      navigate('/invoices')
    } catch (err) {
      toast.error(err.message || 'No se pudo guardar/descargar')
    } finally {
      setDownloading(false)
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 24, flexWrap: 'wrap' }}>
        <h1 style={s.title}>Nueva factura</h1>
        <button
          type="button"
          onClick={() => setShowPreview((v) => !v)}
          style={showPreview ? s.btnActive : s.btnSecondary}
        >
          {showPreview ? 'Ver formulario' : '👁 Vista previa'}
        </button>
      </div>

      {error && <div style={s.errorBanner}>{error}</div>}
      {missing.length > 0 && !error && (
        <div style={s.warnBanner}>⚠ Campos obligatorios sin rellenar: {missing.join(' · ')}</div>
      )}

      {showPreview ? (
        <div>
          <InvoicePreview {...previewData} />
          <div style={{ display: 'flex', gap: 10, marginTop: 20, flexWrap: 'wrap' }}>
            <button type="button" onClick={() => setShowPreview(false)} style={s.btnSecondary}>← Editar</button>
            <button type="button" onClick={submit} style={s.btnPrimary} disabled={saving || downloading}>
              {saving ? 'Guardando…' : 'Guardar factura'}
            </button>
            <button type="button" onClick={submitAndDownload} style={s.btnSecondary} disabled={saving || downloading}>
              {downloading ? 'Generando…' : '⬇ Guardar y descargar PDF'}
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={submit}>
          <div className="form-grid-2" style={{ marginBottom: 14 }}>
            {/* Datos cliente */}
            <div style={s.card}>
              <div style={s.sectionTitle}>Cliente</div>
              {clients.length > 0 && (
                <Field label="Seleccionar cliente">
                  <div className="select-wrap">
                    <select
                      value={form.client_id ?? ''}
                      onChange={handleClientSelect}
                      style={s.input}
                    >
                      <option value="">— Introducir manualmente —</option>
                      {clients.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.nombre}{c.is_default ? ' ★' : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                </Field>
              )}
              <Field label="Nombre / Razón social">
                <input name="client_name" value={form.client_name} onChange={handle} placeholder="Tarima Studio S.L." style={{ ...s.input, ...errStyle(invalid['Cliente']) }} />
              </Field>
              <Field label="NIF / CIF">
                <input name="client_tax_id" value={form.client_tax_id} onChange={handle} placeholder="B87654321" style={s.input} />
              </Field>
              <Field label="Dirección">
                <textarea name="client_address" value={form.client_address} onChange={handle} rows={2} placeholder="Av. Diagonal 405, 08008 Barcelona" style={{ ...s.input, resize: 'vertical' }} />
              </Field>
            </div>

            {/* Datos factura */}
            <div style={s.card}>
              <div style={s.sectionTitle}>Datos de la factura</div>
              <div className="form-grid-2" style={{ gap: 12 }}>
                <Field label="Fecha">
                  <div className="date-wrap">
                    <input name="date" type="date" value={form.date} onChange={handle} style={{ ...s.input, ...errStyle(invalid['Fecha']) }} />
                  </div>
                </Field>
                <Field label="Vencimiento">
                  <div className="date-wrap">
                    <input name="due_date" type="date" value={form.due_date} onChange={handle} style={{ ...s.input, ...errStyle(invalid['Vencimiento']) }} />
                  </div>
                </Field>
              </div>
              <Field label="Forma de pago">
                <input name="payment_method" value={form.payment_method} onChange={handle} style={s.input} />
              </Field>
              <Field label="Retención IRPF (%)">
                <input name="irpf_rate" type="number" min="0" max="100" step="0.1" value={form.irpf_rate} onChange={handle} style={s.input} />
              </Field>
            </div>
          </div>

          {/* Líneas */}
          <div style={s.card}>
            <div style={s.sectionTitle}>Conceptos</div>
            <div className="table-scroll">
              <div className="table-scroll-inner">
                <div style={s.linesHead}>
                  <div>Descripción</div>
                  <div style={{ textAlign: 'right' }}>Cant.</div>
                  <div style={{ textAlign: 'right' }}>Precio (€)</div>
                  <div style={{ textAlign: 'right' }}>IVA (%)</div>
                  <div style={{ textAlign: 'right' }}>Total</div>
                  <div />
                </div>
                {form.lines.map((line, i) => (
                  <div key={i} style={s.lineRow}>
                    <input name="description" value={line.description} onChange={(e) => handleLine(i, e)} placeholder="Descripción" style={s.input} />
                    <input name="quantity" type="number" min="0" step="any" value={line.quantity} onChange={(e) => handleLine(i, e)} style={{ ...s.input, textAlign: 'right' }} />
                    <input name="unit_price" type="number" min="0" step="0.01" value={line.unit_price} onChange={(e) => handleLine(i, e)} style={{ ...s.input, textAlign: 'right' }} />
                    <input name="vat_rate" type="number" min="0" max="100" step="0.1" value={line.vat_rate} onChange={(e) => handleLine(i, e)} style={{ ...s.input, textAlign: 'right' }} />
                    <div style={{ textAlign: 'right', fontSize: 14, fontVariantNumeric: 'tabular-nums', fontFamily: 'var(--font-display)', color: 'var(--text)', paddingTop: 10 }}>
                      {eur2((line.quantity || 0) * (line.unit_price || 0))}
                    </div>
                    <button type="button" onClick={() => removeLine(i)} style={s.delBtn} title="Eliminar línea">✕</button>
                  </div>
                ))}
              </div>
            </div>
            <button type="button" onClick={addLine} style={s.addLineBtn}>+ Añadir línea</button>

            {/* Totales inline */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
              <div style={{ width: 260, fontSize: 13 }}>
                <div style={s.totalRow}><span style={{ color: 'var(--text-muted)' }}>Base imponible</span><span>{eur2(subtotal)}</span></div>
                <div style={s.totalRow}><span style={{ color: 'var(--text-muted)' }}>IVA</span><span>{eur2(vat_total)}</span></div>
                <div style={s.totalRow}><span style={{ color: 'var(--text-muted)' }}>IRPF ({form.irpf_rate}%)</span><span style={{ color: 'var(--coral)' }}>−{eur2(irpf_total)}</span></div>
                <div style={{ ...s.totalRow, fontWeight: 700, fontSize: 16, color: 'var(--menta)', borderTop: '1px solid var(--border)', marginTop: 8, paddingTop: 10 }}>
                  <span>Total</span><span>{eur2(total)}</span>
                </div>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10, marginTop: 14, flexWrap: 'wrap' }}>
            <button type="button" onClick={() => setShowPreview(true)} style={s.btnSecondary}>
              👁 Vista previa
            </button>
            <button type="submit" style={s.btnPrimary} disabled={saving || downloading}>
              {saving ? 'Guardando…' : 'Guardar factura'}
            </button>
            <button type="button" onClick={submitAndDownload} style={s.btnSecondary} disabled={saving || downloading}>
              {downloading ? 'Generando…' : '⬇ Guardar y descargar PDF'}
            </button>
            <button type="button" onClick={() => navigate('/invoices')} style={s.btnGhost}>
              Cancelar
            </button>
          </div>
        </form>
      )}
    </div>
  )
}

function Field({ label, children }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={s.label}>{label}</label>
      {children}
    </div>
  )
}

const s = {
  title: { fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 22, margin: 0, letterSpacing: '-0.01em' },
  error: { color: 'var(--coral)', fontSize: 13, marginBottom: 14 },
  errorBanner: { fontSize: 13, marginBottom: 14, padding: '10px 14px', borderRadius: 'var(--r-sm)', border: '1px solid rgba(240,135,106,0.3)', background: 'var(--surface)', color: 'var(--coral)' },
  warnBanner: { fontSize: 13, marginBottom: 14, padding: '10px 14px', borderRadius: 'var(--r-sm)', border: '1px solid rgba(232,184,75,0.35)', background: 'rgba(232,184,75,0.06)', color: '#E8B84B' },
  inputError: { borderColor: 'var(--coral)', boxShadow: '0 0 0 1px var(--coral)' },
  card: { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-card)', padding: '20px 22px', marginBottom: 14 },
  sectionTitle: { fontSize: 12, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 16 },
  label: { display: 'block', fontSize: 12, fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 6 },
  input: { width: '100%', background: 'var(--surface-3)', border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', padding: '9px 12px', color: 'var(--text)', fontFamily: 'var(--font-ui)', fontSize: 14, outline: 'none', boxSizing: 'border-box' },
  linesHead: { display: 'grid', gridTemplateColumns: '1fr 60px 90px 70px 80px 28px', gap: 8, fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 8 },
  lineRow: { display: 'grid', gridTemplateColumns: '1fr 60px 90px 70px 80px 28px', gap: 8, marginBottom: 8, alignItems: 'center' },
  addLineBtn: { background: 'none', border: '1px dashed var(--dashed)', borderRadius: 'var(--r-sm)', color: 'var(--text-muted)', padding: '8px 14px', cursor: 'pointer', fontSize: 13, marginTop: 4 },
  delBtn: { background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 14, padding: 2 },
  totalRow: { display: 'flex', justifyContent: 'space-between', padding: '5px 0' },
  btnPrimary: { padding: '10px 22px', background: 'var(--menta)', color: 'var(--ink)', border: 'none', borderRadius: 'var(--r-sm)', fontFamily: 'var(--font-ui)', fontSize: 14, fontWeight: 600, cursor: 'pointer' },
  btnSecondary: { padding: '10px 22px', background: 'var(--btn-soft)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', fontFamily: 'var(--font-ui)', fontSize: 14, cursor: 'pointer' },
  btnActive: { padding: '10px 22px', background: 'rgba(69,212,155,0.14)', color: 'var(--menta)', border: '1px solid rgba(69,212,155,0.3)', borderRadius: 'var(--r-sm)', fontFamily: 'var(--font-ui)', fontSize: 14, fontWeight: 600, cursor: 'pointer' },
  btnGhost: { padding: '10px 22px', background: 'transparent', color: 'var(--text-muted)', border: 'none', borderRadius: 'var(--r-sm)', fontFamily: 'var(--font-ui)', fontSize: 14, cursor: 'pointer' },
}
