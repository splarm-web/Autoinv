import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { expensesApi } from '../../lib/api'
import { toISODate } from '../../lib/format'

const EMPTY = {
  date: toISODate(),
  amount: '',
  vat_rate: 21,
  vat_amount: '',
  supplier: '',
  concept: '',
  category: '',
  source: 'manual',
}

export default function NewExpensePage() {
  const navigate = useNavigate()
  const fileRef = useRef(null)
  const [form, setForm] = useState(EMPTY)
  const [categories, setCategories] = useState([])
  const [saving, setSaving] = useState(false)
  const [extracting, setExtracting] = useState(false)
  const [tempPath, setTempPath] = useState(null)
  const [fileName, setFileName] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    expensesApi.categories().then(setCategories)
  }, [])

  const handle = (e) => {
    const { name, value } = e.target
    setForm((f) => ({ ...f, [name]: value }))
  }

  const handleFile = async (file) => {
    if (!file) return
    setFileName(file.name)
    setExtracting(true)
    setError('')
    try {
      const ocr = await expensesApi.upload(file)
      setTempPath(ocr.temp_path || null)
      // Pre-rellenar con los datos extraídos
      setForm((f) => ({
        ...f,
        date: ocr.date || f.date,
        amount: ocr.amount ?? f.amount,
        vat_rate: ocr.vat_rate ?? f.vat_rate,
        vat_amount: ocr.vat_amount ?? f.vat_amount,
        supplier: ocr.supplier || f.supplier,
        concept: ocr.concept || f.concept,
        category: ocr.category || f.category,
        source: file.type.startsWith('image') ? 'foto' : 'pdf',
      }))
    } catch (err) {
      setError(`No se pudieron extraer datos: ${err.message}. Rellena el formulario manualmente.`)
    } finally {
      setExtracting(false)
    }
  }

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    setSaving(true)
    try {
      if (tempPath) {
        await expensesApi.confirm(form, tempPath)
      } else {
        await expensesApi.create({ ...form, amount: parseFloat(form.amount), vat_amount: form.vat_amount ? parseFloat(form.vat_amount) : undefined })
      }
      navigate('/expenses')
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ maxWidth: 560 }}>
      <h1 style={s.title}>Nuevo gasto</h1>

      {/* Drop zone / file upload */}
      <div
        style={s.dropZone}
        onClick={() => fileRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => { e.preventDefault(); handleFile(e.dataTransfer.files[0]) }}
      >
        <input
          ref={fileRef}
          type="file"
          accept="image/*,application/pdf"
          capture="environment"
          style={{ display: 'none' }}
          onChange={(e) => handleFile(e.target.files[0])}
        />
        {extracting ? (
          <span style={{ color: 'var(--menta)', fontSize: 14 }}>Extrayendo datos con IA…</span>
        ) : fileName ? (
          <span style={{ fontSize: 14 }}>📎 {fileName} <span style={{ color: 'var(--menta)', marginLeft: 6 }}>✓ datos extraídos</span></span>
        ) : (
          <>
            <div style={{ fontSize: 24, marginBottom: 8 }}>📸</div>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>Sube foto o PDF del ticket</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Arrastra aquí · Haz clic · O toca para usar la cámara</div>
          </>
        )}
      </div>

      {error && <div style={s.error}>{error}</div>}

      <form onSubmit={submit} style={s.card}>
        <div style={s.sectionTitle}>Detalles del gasto</div>

        <div className="form-grid-2">
          <Field label="Fecha">
            <div className="date-wrap">
              <input name="date" type="date" value={form.date} onChange={handle} required style={s.input} />
            </div>
          </Field>
          <Field label="Importe total (€)">
            <input name="amount" type="number" step="0.01" min="0" value={form.amount} onChange={handle} required placeholder="0,00" style={s.input} />
          </Field>
          <Field label="IVA (%)">
            <input name="vat_rate" type="number" step="0.1" min="0" max="100" value={form.vat_rate} onChange={handle} style={s.input} />
          </Field>
          <Field label="Importe IVA (€)">
            <input name="vat_amount" type="number" step="0.01" min="0" value={form.vat_amount} onChange={handle} placeholder="Auto" style={s.input} />
          </Field>
        </div>

        <Field label="Proveedor">
          <input name="supplier" value={form.supplier} onChange={handle} placeholder="Adobe, Mercadona…" style={s.input} />
        </Field>
        <Field label="Concepto">
          <input name="concept" value={form.concept} onChange={handle} placeholder="Descripción del gasto" style={s.input} />
        </Field>
        <Field label="Categoría">
          <div className="select-wrap">
            <select name="category" value={form.category} onChange={handle} style={s.input}>
              <option value="">Sin categoría</option>
              {categories.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </Field>

        <div style={{ display: 'flex', gap: 10, marginTop: 6, flexWrap: 'wrap' }}>
          <button type="submit" style={s.btnPrimary} disabled={saving || extracting}>
            {saving ? 'Guardando…' : 'Guardar gasto'}
          </button>
          <button type="button" onClick={() => navigate('/expenses')} style={s.btnSecondary}>
            Cancelar
          </button>
        </div>
      </form>
    </div>
  )
}

function Field({ label, children }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={s.label}>{label}</label>
      {children}
    </div>
  )
}

const s = {
  title: { fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 22, margin: '0 0 20px', letterSpacing: '-0.01em' },
  dropZone: {
    border: '2px dashed var(--dashed)',
    borderRadius: 'var(--r-card)',
    padding: '28px 20px',
    textAlign: 'center',
    cursor: 'pointer',
    marginBottom: 16,
    minHeight: 44,
    transition: 'border-color 0.15s',
  },
  error: { color: 'var(--coral)', fontSize: 13, marginBottom: 14 },
  card: { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-card)', padding: '20px 22px' },
  sectionTitle: { fontSize: 12, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 18 },
  label: { display: 'block', fontSize: 12, fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 7 },
  input: { width: '100%', background: 'var(--surface-3)', border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', padding: '10px 14px', color: 'var(--text)', fontFamily: 'var(--font-ui)', fontSize: 14, outline: 'none' },
  btnPrimary: { padding: '11px 24px', background: 'var(--menta)', color: 'var(--ink)', border: 'none', borderRadius: 'var(--r-sm)', fontFamily: 'var(--font-ui)', fontSize: 14, fontWeight: 600, cursor: 'pointer' },
  btnSecondary: { padding: '11px 24px', background: 'transparent', color: 'var(--text-muted)', border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', fontFamily: 'var(--font-ui)', fontSize: 14, cursor: 'pointer' },
}
