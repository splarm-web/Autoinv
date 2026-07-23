import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { clientsApi, invoicesApi } from '../../lib/api'
import { useAuth } from '../../app/AuthContext'
import { eur2 } from '../../lib/format'
import { useToast } from '../../components/Toast'
import TransportePreview from './TransportePreview'

const MESES = ['ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO',
  'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE']

const EMPTY_VIAJE = { fecha: '', viaje: '', kilos: '', precio: '' }
const EMPTY_CLIENTE = { nombre: '', cif: '', direccion: '', ciudad: '' }

const eur = (v) => eur2(v || 0)

function conceptoFromIso(iso) {
  if (!iso) return ''
  const [y, m] = iso.split('-')
  const mes = parseInt(m, 10)
  if (!mes || !y) return ''
  return `${MESES[mes - 1]} ${y}`
}

function toDdmmyyyy(iso) {
  if (!iso) return ''
  const [y, m, d] = iso.split('-')
  if (!y || !m || !d) return iso
  return `${d}/${m}/${y}`
}

// Nº de factura = prefijo + mes de la fecha de emisión (21/02 → A2)
function numeroFromFecha(iso, prefix) {
  const mes = iso ? parseInt(iso.split('-')[1], 10) : NaN
  return isNaN(mes) ? prefix : `${prefix}${mes}`
}

function diaFromIso(iso) {
  if (!iso) return ''
  const d = iso.split('-')[2]
  return d ? String(parseInt(d, 10)) : ''
}

export default function TransporteInvoicePage() {
  const { user } = useAuth()
  const { toast } = useToast()
  const navigate = useNavigate()
  const fileRef = useRef(null)
  const prefix = user?.transporte_invoice_prefix || 'A'

  const [emisor, setEmisor] = useState({ nombre: '', nif: '', direccion: '' })
  const [cliente, setCliente] = useState({ ...EMPTY_CLIENTE })
  const [clients, setClients] = useState([])
  const [clientId, setClientId] = useState('')
  const [savingClient, setSavingClient] = useState(false)

  const [meta, setMeta] = useState({
    numero_factura: `${prefix}${new Date().getMonth() + 1}`,
    fecha: new Date().toISOString().split('T')[0],
    concepto_mes: '',
    cabeza: '',
    cisterna: '',
  })
  const [viajes, setViajes] = useState([{ ...EMPTY_VIAJE }])

  // Campos autorrellenados por el import de Excel (para el helper azul)
  const [autofilled, setAutofilled] = useState({})

  const [uploading, setUploading] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [saving, setSaving] = useState(false)
  const [attempted, setAttempted] = useState(false)   // ya intentó guardar/descargar
  const [showPreview, setShowPreview] = useState(false)
  const [error, setError] = useState('')

  // Pre-rellenar emisor con datos fiscales del usuario logueado (Alfredo)
  useEffect(() => {
    if (user) {
      setEmisor({
        nombre: user.legal_name || '',
        nif: user.nif || '',
        direccion: user.address || '',
      })
    }
  }, [user])

  useEffect(() => {
    clientsApi.list().then(setClients).catch(() => {})
  }, [])

  // Recalcular el nº de factura al cambiar la fecha de emisión o el prefijo
  useEffect(() => {
    setMeta((m) => ({ ...m, numero_factura: numeroFromFecha(m.fecha, prefix) }))
  }, [meta.fecha, prefix])

  const clearAutofilled = (key) => setAutofilled((a) => (a[key] ? { ...a, [key]: false } : a))

  const selectClient = (e) => {
    const id = e.target.value
    setClientId(id)
    if (!id) { setCliente({ ...EMPTY_CLIENTE }); return }
    const c = clients.find((x) => x.id === parseInt(id))
    if (c) setCliente({ nombre: c.nombre || '', cif: c.cif || '', direccion: c.direccion || '', ciudad: c.ciudad || '' })
  }

  const saveNewClient = async () => {
    if (!cliente.nombre.trim()) { toast.error('Pon al menos el nombre del cliente para guardarlo'); return }
    setSavingClient(true)
    try {
      const created = await clientsApi.create({
        nombre: cliente.nombre, cif: cliente.cif,
        direccion: cliente.direccion, ciudad: cliente.ciudad,
      })
      const list = await clientsApi.list()
      setClients(list)
      setClientId(String(created.id))
      toast.success(`Cliente "${created.nombre}" guardado`)
    } catch (err) {
      toast.error(err.message || 'No se pudo guardar el cliente')
    } finally {
      setSavingClient(false)
    }
  }

  const handleUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setError(''); setUploading(true)
    try {
      const data = await invoicesApi.parseTransporteExcel(file)
      const parsed = (data.viajes || []).map((v) => ({
        fecha: v.fecha || '', viaje: v.viaje || '',
        kilos: v.kilos ?? '', precio: v.precio ?? '',
      }))
      setViajes(parsed.length ? parsed : [{ ...EMPTY_VIAJE }])
      const concepto = conceptoFromIso(parsed[0]?.fecha)
      setMeta((m) => ({
        ...m,
        cabeza: data.cabeza || m.cabeza,
        cisterna: data.cisterna || m.cisterna,
        concepto_mes: concepto || m.concepto_mes,
      }))
      setAutofilled({
        viajes: parsed.length > 0,
        cabeza: !!data.cabeza,
        cisterna: !!data.cisterna,
        concepto: !!concepto,
      })
      toast.success(`${parsed.length} viajes cargados desde el Excel`)
    } catch (err) {
      toast.error(err.message || 'No se pudo leer el Excel')
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const handleViaje = (i, field, value) => {
    setViajes((vs) => vs.map((v, idx) => (idx === i ? { ...v, [field]: value } : v)))
    clearAutofilled('viajes')
  }
  const addViaje = () => setViajes((vs) => [...vs, { ...EMPTY_VIAJE }])
  const removeViaje = (i) => setViajes((vs) => vs.filter((_, idx) => idx !== i))

  const num = (v) => parseFloat(v) || 0
  const lineTotal = (v) => (num(v.kilos) / 1000) * num(v.precio)
  const base = viajes.reduce((acc, v) => acc + lineTotal(v), 0)
  const irpf = base * 0.01
  const iva = base * 0.21
  const total = base - irpf + iva

  const viajesValidos = viajes.filter((v) => v.viaje || v.kilos || v.precio)

  // Validación bloqueante (campos obligatorios)
  const invalid = {
    'Nombre del emisor': !emisor.nombre.trim(),
    'NIF del emisor': !emisor.nif.trim(),
    'Dirección del emisor': !emisor.direccion.trim(),
    'Nombre del cliente': !cliente.nombre.trim(),
    'CIF/DNI del cliente': !cliente.cif.trim(),
    'Dirección del cliente': !cliente.direccion.trim(),
    'Nº de factura': !meta.numero_factura.trim(),
    'Fecha': !meta.fecha,
    'Concepto (mes)': !meta.concepto_mes.trim(),
    'Al menos un viaje': viajesValidos.length === 0,
  }
  const missing = Object.keys(invalid).filter((k) => invalid[k])
  const errStyle = (isBad) => (attempted && isBad ? s.inputError : null)

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

  const buildPayload = () => ({
    emisor,
    cliente,
    numero_factura: meta.numero_factura,
    fecha_factura: toDdmmyyyy(meta.fecha),
    concepto_mes: meta.concepto_mes,
    cabeza: meta.cabeza,
    cisterna: meta.cisterna,
    viajes: viajesValidos.map((v) => ({
      fecha: v.fecha, viaje: v.viaje, kilos: num(v.kilos), precio: num(v.precio),
    })),
  })

  const generate = async () => {
    if (!guard()) return
    setGenerating(true)
    try {
      await invoicesApi.transportePdf(buildPayload())
      toast.success('PDF generado')
    } catch (err) {
      toast.error(err.message || 'No se pudo generar el PDF')
    } finally {
      setGenerating(false)
    }
  }

  const save = async () => {
    if (!guard()) return
    setSaving(true)
    try {
      await invoicesApi.saveTransporte(buildPayload())
      toast.success('Factura guardada')
      navigate('/invoices')
    } catch (err) {
      toast.error(err.message || 'No se pudo guardar la factura')
    } finally {
      setSaving(false)
    }
  }

  // Datos para la vista previa
  const previewData = {
    emisor,
    cliente,
    meta: {
      numero_factura: meta.numero_factura,
      fecha: toDdmmyyyy(meta.fecha),
      concepto_mes: meta.concepto_mes,
      cabeza: meta.cabeza,
    },
    viajes: viajesValidos.map((v) => ({
      dia: diaFromIso(v.fecha), viaje: v.viaje,
      kilos: num(v.kilos), precio: num(v.precio), total: lineTotal(v),
    })),
    totals: { base, irpf, iva, total },
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 8, flexWrap: 'wrap' }}>
        <h1 style={s.title}>Factura transporte (Alfredo)</h1>
        <button
          type="button"
          onClick={() => setShowPreview((v) => !v)}
          style={showPreview ? s.btnActive : s.btnSecondary}
        >
          {showPreview ? 'Ver formulario' : '👁 Vista previa'}
        </button>
      </div>
      <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 6, marginBottom: 20 }}>
        Sube el Excel para autorellenar los viajes, edítalos si hace falta y genera el PDF.
      </p>

      {error && <div style={{ ...s.banner, color: 'var(--coral)', borderColor: 'rgba(240,135,106,0.3)' }}>{error}</div>}
      {missing.length > 0 && !error && (
        <div style={{ ...s.banner, color: '#E8B84B', borderColor: 'rgba(232,184,75,0.35)', background: 'rgba(232,184,75,0.06)' }}>
          ⚠ Campos obligatorios sin rellenar: {missing.join(' · ')}
        </div>
      )}

      {showPreview ? (
        <div>
          <TransportePreview {...previewData} />
          <div style={{ display: 'flex', gap: 10, marginTop: 20, flexWrap: 'wrap' }}>
            <button type="button" onClick={() => setShowPreview(false)} style={s.btnSecondary}>← Editar</button>
            <button type="button" onClick={save} style={s.btnPrimary} disabled={saving || generating}>
              {saving ? 'Guardando…' : 'Guardar factura'}
            </button>
            <button type="button" onClick={generate} style={s.btnSecondary} disabled={saving || generating}>
              {generating ? 'Generando…' : '⬇ Descargar PDF'}
            </button>
          </div>
        </div>
      ) : (
      <>
      {/* Subida de Excel */}
      <div style={{ ...s.card, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 600 }}>Importar desde Excel</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
            Columnas: Fecha · Viaje · Kilos (toneladas) · Precio
          </div>
        </div>
        <label style={s.btnSecondary}>
          {uploading ? 'Leyendo…' : '📄 Subir Excel'}
          <input ref={fileRef} type="file" accept=".xlsx,.xlsm,.xls" onChange={handleUpload} style={{ display: 'none' }} />
        </label>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
        {/* Emisor */}
        <div style={s.card}>
          <div style={s.sectionTitle}>Emisor</div>
          <Field label="Nombre"><input value={emisor.nombre} onChange={(e) => setEmisor({ ...emisor, nombre: e.target.value })} style={{ ...s.input, ...errStyle(invalid['Nombre del emisor']) }} placeholder="TRANSPORTES…" /></Field>
          <Field label="NIF"><input value={emisor.nif} onChange={(e) => setEmisor({ ...emisor, nif: e.target.value })} style={{ ...s.input, ...errStyle(invalid['NIF del emisor']) }} /></Field>
          <Field label="Dirección" hint="Una línea por renglón (dirección, ciudad, teléfono…)">
            <textarea value={emisor.direccion} onChange={(e) => setEmisor({ ...emisor, direccion: e.target.value })} rows={3} style={{ ...s.input, resize: 'vertical', ...errStyle(invalid['Dirección del emisor']) }} placeholder={'C/ Apostol Santiago 16 1º\n46740 Carcaixent (VALENCIA)\nTlf. 607411838'} />
          </Field>
          <div style={s.hintBox}>Estos datos salen de tu perfil fiscal (Ajustes).</div>
        </div>

        {/* Cliente */}
        <div style={s.card}>
          <div style={{ ...s.sectionTitle, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>Cliente</span>
            {clientId === '' && cliente.nombre.trim() && (
              <button type="button" onClick={saveNewClient} disabled={savingClient} style={s.saveClientBtn}>
                {savingClient ? 'Guardando…' : '＋ Guardar como cliente'}
              </button>
            )}
          </div>
          <Field label="Cliente guardado">
            <select value={clientId} onChange={selectClient} style={{ ...s.input, appearance: 'auto' }}>
              <option value="">— Nuevo / introducir manualmente —</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>{c.nombre}{c.is_default ? ' ★' : ''}</option>
              ))}
            </select>
          </Field>
          <Field label="Nombre"><input value={cliente.nombre} onChange={(e) => setCliente({ ...cliente, nombre: e.target.value })} style={{ ...s.input, ...errStyle(invalid['Nombre del cliente']) }} /></Field>
          <Field label="CIF / DNI"><input value={cliente.cif} onChange={(e) => setCliente({ ...cliente, cif: e.target.value })} style={{ ...s.input, ...errStyle(invalid['CIF/DNI del cliente']) }} /></Field>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label="Dirección"><input value={cliente.direccion} onChange={(e) => setCliente({ ...cliente, direccion: e.target.value })} style={{ ...s.input, ...errStyle(invalid['Dirección del cliente']) }} /></Field>
            <Field label="Ciudad"><input value={cliente.ciudad} onChange={(e) => setCliente({ ...cliente, ciudad: e.target.value })} style={s.input} /></Field>
          </div>
        </div>
      </div>

      {/* Datos factura */}
      <div style={s.card}>
        <div style={s.sectionTitle}>Datos de la factura</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
          <Field label="Nº factura" hint="Se genera con el prefijo (Ajustes) + mes de la fecha">
            <input value={meta.numero_factura} onChange={(e) => setMeta({ ...meta, numero_factura: e.target.value })} style={{ ...s.input, ...errStyle(invalid['Nº de factura']) }} />
          </Field>
          <Field label="Fecha"><input type="date" value={meta.fecha} onChange={(e) => setMeta({ ...meta, fecha: e.target.value })} style={{ ...s.input, ...errStyle(invalid['Fecha']) }} /></Field>
          <Field label="Concepto (mes año)" info={autofilled.concepto && meta.concepto_mes ? 'Leído del Excel' : ''}>
            <input value={meta.concepto_mes} onChange={(e) => { setMeta({ ...meta, concepto_mes: e.target.value }); clearAutofilled('concepto') }} placeholder="SEPTIEMBRE 2025" style={{ ...s.input, ...errStyle(invalid['Concepto (mes)']) }} />
          </Field>
          <Field label="Cabeza tractora" info={autofilled.cabeza && meta.cabeza ? 'Leído del Excel' : ''}>
            <input value={meta.cabeza} onChange={(e) => { setMeta({ ...meta, cabeza: e.target.value }); clearAutofilled('cabeza') }} style={s.input} />
          </Field>
          <Field label="Cisterna" info={autofilled.cisterna && meta.cisterna ? 'Leído del Excel' : ''}>
            <input value={meta.cisterna} onChange={(e) => { setMeta({ ...meta, cisterna: e.target.value }); clearAutofilled('cisterna') }} style={s.input} />
          </Field>
        </div>
      </div>

      {/* Tabla de viajes */}
      <div style={s.card}>
        <div style={{ ...s.sectionTitle, display: 'flex', alignItems: 'center', gap: 10 }}>
          <span>Viajes realizados</span>
          {autofilled.viajes && <span style={s.infoBadge}>Leído del Excel</span>}
        </div>
        <div style={s.linesHead}>
          <div>Fecha</div>
          <div>Viaje</div>
          <div style={{ textAlign: 'right' }}>Kilos</div>
          <div style={{ textAlign: 'right' }}>Precio</div>
          <div style={{ textAlign: 'right' }}>Total</div>
          <div />
        </div>
        {viajes.map((v, i) => (
          <div key={i} style={s.lineRow}>
            <input type="date" value={v.fecha} onChange={(e) => handleViaje(i, 'fecha', e.target.value)} style={s.input} />
            <input value={v.viaje} onChange={(e) => handleViaje(i, 'viaje', e.target.value)} placeholder="Origen - Destino" style={s.input} />
            <input type="number" min="0" step="any" value={v.kilos} onChange={(e) => handleViaje(i, 'kilos', e.target.value)} placeholder="kg" style={{ ...s.input, textAlign: 'right' }} />
            <input type="number" min="0" step="any" value={v.precio} onChange={(e) => handleViaje(i, 'precio', e.target.value)} placeholder="€/t" style={{ ...s.input, textAlign: 'right' }} />
            <div style={{ textAlign: 'right', fontSize: 13, fontVariantNumeric: 'tabular-nums', fontFamily: 'var(--font-display)', color: 'var(--text)', paddingTop: 10 }}>
              {eur(lineTotal(v))}
            </div>
            <button type="button" onClick={() => removeViaje(i)} style={s.delBtn} title="Eliminar fila">✕</button>
          </div>
        ))}
        <button type="button" onClick={addViaje} style={s.addLineBtn}>+ Añadir viaje</button>

        {/* Totales */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
          <div style={{ width: 280, fontSize: 13 }}>
            <div style={s.totalRow}><span style={{ color: 'var(--text-muted)' }}>Base imponible</span><span>{eur(base)}</span></div>
            <div style={s.totalRow}><span style={{ color: 'var(--text-muted)' }}>IRPF (1%)</span><span style={{ color: 'var(--coral)' }}>−{eur(irpf)}</span></div>
            <div style={s.totalRow}><span style={{ color: 'var(--text-muted)' }}>IVA (21%)</span><span>{eur(iva)}</span></div>
            <div style={{ ...s.totalRow, fontWeight: 700, fontSize: 16, color: 'var(--menta)', borderTop: '1px solid var(--border)', marginTop: 8, paddingTop: 10 }}>
              <span>Total euros</span><span>{eur(total)}</span>
            </div>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, marginTop: 14, flexWrap: 'wrap' }}>
        <button type="button" onClick={save} style={s.btnPrimary} disabled={saving || generating}>
          {saving ? 'Guardando…' : 'Guardar factura'}
        </button>
        <button type="button" onClick={generate} style={s.btnSecondary} disabled={saving || generating}>
          {generating ? 'Generando…' : '⬇ Descargar PDF'}
        </button>
        <button type="button" onClick={() => setShowPreview(true)} style={s.btnSecondary}>👁 Vista previa</button>
        <button type="button" onClick={() => navigate('/invoices')} style={s.btnGhost}>Cancelar</button>
      </div>
      </>
      )}
    </div>
  )
}

function Field({ label, hint, info, children }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={s.label}>{label}</label>
      {children}
      {info && <div style={{ fontSize: 11, color: 'var(--cielo)', marginTop: 5, display: 'flex', alignItems: 'center', gap: 5 }}>ⓘ {info}</div>}
      {hint && !info && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 5 }}>{hint}</div>}
    </div>
  )
}

const s = {
  title: { fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 22, margin: 0, letterSpacing: '-0.01em' },
  banner: { fontSize: 13, marginBottom: 14, padding: '10px 14px', borderRadius: 'var(--r-sm)', border: '1px solid', background: 'var(--surface)' },
  card: { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-card)', padding: '20px 22px', marginBottom: 14 },
  sectionTitle: { fontSize: 12, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 16 },
  label: { display: 'block', fontSize: 12, fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 6 },
  input: { width: '100%', background: 'var(--surface-3)', border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', padding: '9px 12px', color: 'var(--text)', fontFamily: 'var(--font-ui)', fontSize: 14, outline: 'none', boxSizing: 'border-box', colorScheme: 'dark' },
  inputError: { borderColor: 'var(--coral)', boxShadow: '0 0 0 1px var(--coral)' },
  hintBox: { fontSize: 11, color: 'var(--text-muted)', marginTop: 2 },
  infoBadge: { fontSize: 10, fontWeight: 600, letterSpacing: '0.03em', color: 'var(--cielo)', background: 'rgba(111,168,255,0.12)', border: '1px solid rgba(111,168,255,0.25)', borderRadius: 999, padding: '2px 8px', textTransform: 'none' },
  saveClientBtn: { background: 'rgba(69,212,155,0.12)', border: '1px solid rgba(69,212,155,0.3)', color: 'var(--menta)', borderRadius: 'var(--r-sm)', padding: '4px 10px', fontSize: 11, fontWeight: 600, cursor: 'pointer', letterSpacing: 0, textTransform: 'none' },
  linesHead: { display: 'grid', gridTemplateColumns: '150px 1fr 90px 80px 90px 28px', gap: 8, fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 8 },
  lineRow: { display: 'grid', gridTemplateColumns: '150px 1fr 90px 80px 90px 28px', gap: 8, marginBottom: 8, alignItems: 'center' },
  addLineBtn: { background: 'none', border: '1px dashed rgba(255,255,255,0.12)', borderRadius: 'var(--r-sm)', color: 'var(--text-muted)', padding: '8px 14px', cursor: 'pointer', fontSize: 13, marginTop: 4 },
  delBtn: { background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 14, padding: 2 },
  totalRow: { display: 'flex', justifyContent: 'space-between', padding: '5px 0' },
  btnPrimary: { padding: '10px 22px', background: 'var(--menta)', color: 'var(--ink)', border: 'none', borderRadius: 'var(--r-sm)', fontFamily: 'var(--font-ui)', fontSize: 14, fontWeight: 600, cursor: 'pointer' },
  btnSecondary: { padding: '10px 22px', background: 'rgba(255,255,255,0.06)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', fontFamily: 'var(--font-ui)', fontSize: 14, cursor: 'pointer', display: 'inline-block' },
  btnActive: { padding: '10px 22px', background: 'rgba(69,212,155,0.14)', color: 'var(--menta)', border: '1px solid rgba(69,212,155,0.3)', borderRadius: 'var(--r-sm)', fontFamily: 'var(--font-ui)', fontSize: 14, fontWeight: 600, cursor: 'pointer' },
  btnGhost: { padding: '10px 22px', background: 'transparent', color: 'var(--text-muted)', border: 'none', borderRadius: 'var(--r-sm)', fontFamily: 'var(--font-ui)', fontSize: 14, cursor: 'pointer' },
}
