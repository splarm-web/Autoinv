import { useState } from 'react'
import { authApi } from '../../lib/api'
import { useAuth } from '../../app/AuthContext'
import { useToast } from '../../components/Toast'

export default function SettingsPage() {
  const { user, updateUser, hasFeature } = useAuth()
  const { toast } = useToast()
  const [form, setForm] = useState({
    legal_name: user?.legal_name || '',
    nif: user?.nif || '',
    address: user?.address || '',
    default_vat: user?.default_vat ?? 21,
    irpf_rate: user?.irpf_rate ?? 15,
    invoice_number_format: user?.invoice_number_format || 'YYYY-NNN',
    transporte_invoice_prefix: user?.transporte_invoice_prefix || 'A',
  })
  const isTransporte = hasFeature('transporte')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const handle = (e) => {
    const { name, value, type } = e.target
    setForm({ ...form, [name]: type === 'number' ? parseFloat(value) : value })
    setSaved(false)
  }

  const submit = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      const updated = await authApi.updateMe(form)
      updateUser(updated)
      setSaved(true)
      toast.success('Ajustes guardados')
    } catch (e) {
      toast.error(e.message || 'No se pudieron guardar los ajustes')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ maxWidth: 560 }}>
      <h1 style={s.title}>Ajustes fiscales</h1>
      <p style={s.subtitle}>Estos datos aparecen en tus facturas y se usan para calcular el IVA e IRPF.</p>

      <form onSubmit={submit}>
        <div style={s.section}>
          <div style={s.sectionTitle}>Datos del emisor</div>

          <Field label="Nombre o razón social">
            <input name="legal_name" value={form.legal_name} onChange={handle} placeholder="Laura Méndez Castro" style={s.input} />
          </Field>
          <Field label="NIF / CIF">
            <input name="nif" value={form.nif} onChange={handle} placeholder="51234567X" style={s.input} />
          </Field>
          <Field label="Dirección fiscal">
            <textarea name="address" value={form.address} onChange={handle} placeholder="C/ Sagasta 14, 3ºB&#10;28004 Madrid" rows={3} style={{ ...s.input, resize: 'vertical' }} />
          </Field>
        </div>

        <div style={s.section}>
          <div style={s.sectionTitle}>IVA e IRPF</div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <Field label="IVA por defecto (%)">
              <input name="default_vat" type="number" min="0" max="100" step="0.1" value={form.default_vat} onChange={handle} style={s.input} />
            </Field>
            <Field label="Retención IRPF (%)">
              <input name="irpf_rate" type="number" min="0" max="100" step="0.1" value={form.irpf_rate} onChange={handle} style={s.input} />
            </Field>
          </div>
        </div>

        <div style={s.section}>
          <div style={s.sectionTitle}>Facturación</div>

          {hasFeature('facturas') && (
            <>
              <Field label="Formato numeración" hint="YYYY = año, NNN = secuencia (ej: 2026-001)">
                <input name="invoice_number_format" value={form.invoice_number_format} onChange={handle} placeholder="YYYY-NNN" style={s.input} />
              </Field>
              <div style={s.preview}>
                Vista previa: <strong style={{ color: 'var(--menta)' }}>
                  {form.invoice_number_format
                    .replace('YYYY', new Date().getFullYear())
                    .replace('NNN', '001')}
                </strong>
              </div>
            </>
          )}

          {isTransporte && (
            <Field label="Prefijo nº factura (transporte)" hint="Se combina con el mes de la fecha de emisión (ej: 21/02 → A2)">
              <input name="transporte_invoice_prefix" value={form.transporte_invoice_prefix} onChange={handle} placeholder="A" maxLength={4} style={{ ...s.input, maxWidth: 120 }} />
              <div style={{ ...s.preview, marginTop: 8 }}>
                Vista previa: <strong style={{ color: 'var(--menta)' }}>
                  {(form.transporte_invoice_prefix || 'A') + (new Date().getMonth() + 1)}
                </strong>
              </div>
            </Field>
          )}
        </div>

        <button type="submit" style={s.btn} disabled={saving}>
          {saving ? 'Guardando…' : saved ? '✓ Guardado' : 'Guardar cambios'}
        </button>
      </form>
    </div>
  )
}

function Field({ label, hint, children }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={s.label}>{label}</label>
      {children}
      {hint && <div style={s.hint}>{hint}</div>}
    </div>
  )
}

const s = {
  title: { fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 22, margin: '0 0 6px', letterSpacing: '-0.01em' },
  subtitle: { fontSize: 14, color: 'var(--text-muted)', margin: '0 0 28px' },
  section: { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-card)', padding: '20px 22px', marginBottom: 14 },
  sectionTitle: { fontSize: 12, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 18 },
  label: { display: 'block', fontSize: 12, fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 7 },
  input: { width: '100%', background: 'var(--surface-3)', border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', padding: '10px 14px', color: 'var(--text)', fontFamily: 'var(--font-ui)', fontSize: 14, outline: 'none' },
  hint: { fontSize: 12, color: 'var(--text-muted)', marginTop: 5 },
  preview: { fontSize: 13, color: 'var(--text-muted)', marginTop: 8 },
  btn: { padding: '11px 24px', background: 'var(--menta)', color: 'var(--ink)', border: 'none', borderRadius: 'var(--r-sm)', fontFamily: 'var(--font-ui)', fontSize: 14, fontWeight: 600, cursor: 'pointer' },
}
