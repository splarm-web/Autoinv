import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { clientsApi, invoicesApi } from '../../lib/api'
import { useAuth } from '../../app/AuthContext'

const MESES = ['ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO',
  'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE']

const EMPTY_VIAJE = { fecha: '', viaje: '', kilos: '', precio: '' }

const eur = (v) => `${(v || 0).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`

// Deriva "MES AÑO" a partir de una fecha ISO (yyyy-mm-dd)
function conceptoFromIso(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d)) return ''
  return `${MESES[d.getMonth()]} ${d.getFullYear()}`
}

// yyyy-mm-dd → dd/mm/yyyy
function toDdmmyyyy(iso) {
  if (!iso) return ''
  const [y, m, d] = iso.split('-')
  if (!y || !m || !d) return iso
  return `${d}/${m}/${y}`
}

export default function TransporteInvoicePage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const fileRef = useRef(null)

  const [emisor, setEmisor] = useState({ nombre: '', nif: '', direccion: '', ciudad: '', telefono: '' })
  const [cliente, setCliente] = useState({ nombre: '', cif: '', direccion: '', ciudad: '' })
  const [clients, setClients] = useState([])
  const [clientId, setClientId] = useState('')

  const [meta, setMeta] = useState({
    numero_factura: 'A-1',
    fecha: new Date().toISOString().split('T')[0],
    concepto_mes: '',
    cabeza: '',
    cisterna: '',
  })
  const [viajes, setViajes] = useState([{ ...EMPTY_VIAJE }])

  const [uploading, setUploading] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')

  // Pre-rellenar emisor con datos fiscales del usuario
  useEffect(() => {
    if (user) {
      setEmisor((e) => ({
        ...e,
        nombre: user.legal_name || '',
        nif: user.nif || '',
        direccion: user.address || '',
      }))
    }
  }, [user])

  useEffect(() => {
    clientsApi.list().then(setClients).catch(() => {})
  }, [])

  const selectClient = (e) => {
    const id = e.target.value
    setClientId(id)
    if (!id) { setCliente({ nombre: '', cif: '', direccion: '', ciudad: '' }); return }
    const c = clients.find((x) => x.id === parseInt(id))
    if (c) setCliente({ nombre: c.nombre || '', cif: c.cif || '', direccion: c.direccion || '', ciudad: c.ciudad || '' })
  }

  const handleUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setError(''); setInfo(''); setUploading(true)
    try {
      const data = await invoicesApi.parseTransporteExcel(file)
      const parsed = (data.viajes || []).map((v) => ({
        fecha: v.fecha || '',
        viaje: v.viaje || '',
        kilos: v.kilos ?? '',
        precio: v.precio ?? '',
      }))
      setViajes(parsed.length ? parsed : [{ ...EMPTY_VIAJE }])
      setMeta((m) => ({
        ...m,
        cabeza: data.cabeza || m.cabeza,
        cisterna: data.cisterna || m.cisterna,
        concepto_mes: conceptoFromIso(parsed[0]?.fecha) || m.concepto_mes,
      }))
      setInfo(`✓ ${parsed.length} viajes cargados desde el Excel`)
    } catch (err) {
      setError(err.message || 'No se pudo leer el Excel')
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const handleViaje = (i, field, value) => {
    setViajes((vs) => vs.map((v, idx) => (idx === i ? { ...v, [field]: value } : v)))
  }
  const addViaje = () => setViajes((vs) => [...vs, { ...EMPTY_VIAJE }])
  const removeViaje = (i) => setViajes((vs) => vs.filter((_, idx) => idx !== i))

  const num = (v) => parseFloat(v) || 0
  const lineTotal = (v) => (num(v.kilos) / 1000) * num(v.precio)
  const base = viajes.reduce((acc, v) => acc + lineTotal(v), 0)
  const irpf = base * 0.01
  const iva = base * 0.21
  const total = base - irpf + iva

  const generate = async () => {
    setError(''); setGenerating(true)
    try {
      await invoicesApi.transportePdf({
        emisor,
        cliente,
        numero_factura: meta.numero_factura,
        fecha_factura: toDdmmyyyy(meta.fecha),
        concepto_mes: meta.concepto_mes,
        cabeza: meta.cabeza,
        cisterna: meta.cisterna,
        viajes: viajes
          .filter((v) => v.viaje || v.kilos || v.precio)
          .map((v) => ({ fecha: v.fecha, viaje: v.viaje, kilos: num(v.kilos), precio: num(v.precio) })),
      })
    } catch (err) {
      setError(err.message || 'No se pudo generar el PDF')
    } finally {
      setGenerating(false)
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 8, flexWrap: 'wrap' }}>
        <h1 style={s.title}>Factura de transporte</h1>
      </div>
      <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 0, marginBottom: 20 }}>
        Sube el Excel para autorellenar los viajes, edítalos si hace falta y genera el PDF.
      </p>

      {error && <div style={{ ...s.banner, color: 'var(--coral)', borderColor: 'rgba(240,135,106,0.3)' }}>{error}</div>}
      {info && <div style={{ ...s.banner, color: 'var(--menta)', borderColor: 'rgba(69,212,155,0.3)' }}>{info}</div>}

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
          <Field label="Nombre"><input value={emisor.nombre} onChange={(e) => setEmisor({ ...emisor, nombre: e.target.value })} style={s.input} placeholder="TRANSPORTES…" /></Field>
          <Field label="NIF"><input value={emisor.nif} onChange={(e) => setEmisor({ ...emisor, nif: e.target.value })} style={s.input} /></Field>
          <Field label="Dirección"><input value={emisor.direccion} onChange={(e) => setEmisor({ ...emisor, direccion: e.target.value })} style={s.input} /></Field>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label="Ciudad"><input value={emisor.ciudad} onChange={(e) => setEmisor({ ...emisor, ciudad: e.target.value })} style={s.input} /></Field>
            <Field label="Teléfono"><input value={emisor.telefono} onChange={(e) => setEmisor({ ...emisor, telefono: e.target.value })} style={s.input} /></Field>
          </div>
        </div>

        {/* Cliente */}
        <div style={s.card}>
          <div style={s.sectionTitle}>Cliente</div>
          {clients.length > 0 && (
            <Field label="Seleccionar cliente">
              <select value={clientId} onChange={selectClient} style={{ ...s.input, appearance: 'auto' }}>
                <option value="">— Introducir manualmente —</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>{c.nombre}{c.is_default ? ' ★' : ''}</option>
                ))}
              </select>
            </Field>
          )}
          <Field label="Nombre"><input value={cliente.nombre} onChange={(e) => setCliente({ ...cliente, nombre: e.target.value })} style={s.input} /></Field>
          <Field label="CIF / DNI"><input value={cliente.cif} onChange={(e) => setCliente({ ...cliente, cif: e.target.value })} style={s.input} /></Field>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label="Dirección"><input value={cliente.direccion} onChange={(e) => setCliente({ ...cliente, direccion: e.target.value })} style={s.input} /></Field>
            <Field label="Ciudad"><input value={cliente.ciudad} onChange={(e) => setCliente({ ...cliente, ciudad: e.target.value })} style={s.input} /></Field>
          </div>
        </div>
      </div>

      {/* Datos factura */}
      <div style={s.card}>
        <div style={s.sectionTitle}>Datos de la factura</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
          <Field label="Nº factura"><input value={meta.numero_factura} onChange={(e) => setMeta({ ...meta, numero_factura: e.target.value })} style={s.input} /></Field>
          <Field label="Fecha"><input type="date" value={meta.fecha} onChange={(e) => setMeta({ ...meta, fecha: e.target.value })} style={s.input} /></Field>
          <Field label="Concepto (mes año)"><input value={meta.concepto_mes} onChange={(e) => setMeta({ ...meta, concepto_mes: e.target.value })} placeholder="SEPTIEMBRE 2025" style={s.input} /></Field>
          <Field label="Cabeza tractora"><input value={meta.cabeza} onChange={(e) => setMeta({ ...meta, cabeza: e.target.value })} style={s.input} /></Field>
          <Field label="Cisterna"><input value={meta.cisterna} onChange={(e) => setMeta({ ...meta, cisterna: e.target.value })} style={s.input} /></Field>
        </div>
      </div>

      {/* Tabla de viajes */}
      <div style={s.card}>
        <div style={s.sectionTitle}>Viajes realizados</div>
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

      <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
        <button type="button" onClick={generate} style={s.btnPrimary} disabled={generating}>
          {generating ? 'Generando…' : '⬇ Generar PDF'}
        </button>
        <button type="button" onClick={() => navigate('/invoices')} style={s.btnGhost}>Cancelar</button>
      </div>
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
  banner: { fontSize: 13, marginBottom: 14, padding: '10px 14px', borderRadius: 'var(--r-sm)', border: '1px solid', background: 'var(--surface)' },
  card: { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-card)', padding: '20px 22px', marginBottom: 14 },
  sectionTitle: { fontSize: 12, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 16 },
  label: { display: 'block', fontSize: 12, fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 6 },
  input: { width: '100%', background: 'var(--surface-3)', border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', padding: '9px 12px', color: 'var(--text)', fontFamily: 'var(--font-ui)', fontSize: 14, outline: 'none', boxSizing: 'border-box', colorScheme: 'dark' },
  linesHead: { display: 'grid', gridTemplateColumns: '150px 1fr 90px 80px 90px 28px', gap: 8, fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 8 },
  lineRow: { display: 'grid', gridTemplateColumns: '150px 1fr 90px 80px 90px 28px', gap: 8, marginBottom: 8, alignItems: 'center' },
  addLineBtn: { background: 'none', border: '1px dashed rgba(255,255,255,0.12)', borderRadius: 'var(--r-sm)', color: 'var(--text-muted)', padding: '8px 14px', cursor: 'pointer', fontSize: 13, marginTop: 4 },
  delBtn: { background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 14, padding: 2 },
  totalRow: { display: 'flex', justifyContent: 'space-between', padding: '5px 0' },
  btnPrimary: { padding: '10px 22px', background: 'var(--menta)', color: 'var(--ink)', border: 'none', borderRadius: 'var(--r-sm)', fontFamily: 'var(--font-ui)', fontSize: 14, fontWeight: 600, cursor: 'pointer' },
  btnSecondary: { padding: '10px 22px', background: 'rgba(255,255,255,0.06)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', fontFamily: 'var(--font-ui)', fontSize: 14, cursor: 'pointer', display: 'inline-block' },
  btnGhost: { padding: '10px 22px', background: 'transparent', color: 'var(--text-muted)', border: 'none', borderRadius: 'var(--r-sm)', fontFamily: 'var(--font-ui)', fontSize: 14, cursor: 'pointer' },
}
