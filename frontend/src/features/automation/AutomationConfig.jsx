import { useEffect, useState } from 'react'
import { automationApi, clientsApi } from '../../lib/api'
import { useAuth } from '../../app/AuthContext'
import { useToast } from '../../components/Toast'
import { activarPush, desactivarPush, esIOS, esPWAInstalada, estadoPush } from '../../lib/push'

const VACIA = {
  imap_email: '', imap_app_password: '',
  sender_filter: '', subject_filter: '', attachment_filter: '',
  invoice_kind: 'transporte', client_id: '', fecha_origen: 'fin_de_mes',
  default_cabeza: '', default_cisterna: '',
  require_validation: true, notify_push: true,
  send_on_approve: false, reply_to_email: '', reply_cc_email: '',
  reply_subject: 'Factura {numero} — {fecha}',
  reply_body: 'Adjunto la factura {numero} por importe de {total} €.\n\nUn saludo.',
  poll_interval_minutes: 5,
}

export default function AutomationConfig({ status, onCambio }) {
  const { toast } = useToast()
  const { user } = useAuth()
  const [form, setForm] = useState(VACIA)
  // Copia de lo último guardado, para saber si hay cambios pendientes
  const [guardado, setGuardado] = useState(VACIA)
  const [clientes, setClientes] = useState([])
  const [tienePassword, setTienePassword] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [probando, setProbando] = useState(false)
  const [probandoFiltros, setProbandoFiltros] = useState(false)
  const [muestras, setMuestras] = useState(null)
  const [push, setPush] = useState('pendiente')
  const [chequeos, setChequeos] = useState(null)
  const [diagnosticando, setDiagnosticando] = useState(false)

  useEffect(() => {
    automationApi.getConfig().then((c) => {
      setTienePassword(c.has_password)
      const cargado = {
        ...VACIA,
        ...Object.fromEntries(
          Object.entries(c).filter(([k, v]) => k in VACIA && v !== null && v !== undefined),
        ),
        imap_app_password: '',
        client_id: c.client_id ?? '',
      }
      setForm(cargado)
      setGuardado(cargado)
    }).catch(() => {})
    clientsApi.list().then(setClientes).catch(() => {})
    estadoPush().then(setPush)
  }, [])

  const set = (campo, valor) => setForm((f) => ({ ...f, [campo]: valor }))

  const guardar = async () => {
    if (!form.imap_email) { toast.error('Falta el correo desde el que se leen los Excel'); return }
    setGuardando(true)
    try {
      const payload = {
        ...form,
        client_id: form.client_id ? parseInt(form.client_id) : null,
        poll_interval_minutes: parseInt(form.poll_interval_minutes) || 5,
      }
      if (!payload.imap_app_password) delete payload.imap_app_password
      const c = await automationApi.saveConfig(payload)
      setTienePassword(c.has_password)
      const limpio = { ...form, imap_app_password: '' }
      setForm(limpio)
      setGuardado(limpio)
      toast.success('Configuración guardada')
      onCambio()
    } catch (e) {
      toast.error(e.message || 'No se pudo guardar')
    } finally {
      setGuardando(false)
    }
  }

  const probarConexion = async () => {
    setProbando(true)
    try {
      const r = await automationApi.testConnection({
        imap_email: form.imap_email,
        imap_app_password: form.imap_app_password || undefined,
      })
      r.ok ? toast.success(r.message) : toast.error(r.message)
    } catch (e) {
      toast.error(e.message || 'No se pudo conectar')
    } finally {
      setProbando(false)
    }
  }

  const probarFiltros = async () => {
    setProbandoFiltros(true)
    setMuestras(null)
    try {
      const r = await automationApi.testFilters({
        sender_filter: form.sender_filter || null,
        subject_filter: form.subject_filter || null,
        attachment_filter: form.attachment_filter || null,
      })
      setMuestras(r)
      if (!r.length) toast.info('No hay correos recientes que revisar')
    } catch (e) {
      toast.error(e.message || 'No se pudieron probar los filtros')
    } finally {
      setProbandoFiltros(false)
    }
  }

  const cambiarActiva = async (activar) => {
    try {
      await automationApi.toggle(activar)
      toast.success(activar ? 'Automatización activada' : 'Automatización desactivada')
      onCambio()
    } catch (e) {
      toast.error(e.message)
    }
  }

  const cambiarPush = async () => {
    try {
      if (push === 'activo') {
        setPush(await desactivarPush())
        toast.info('Notificaciones desactivadas en este dispositivo')
      } else {
        setPush(await activarPush(status?.vapid_public_key))
        toast.success('Notificaciones activadas en este dispositivo')
      }
    } catch (e) {
      toast.error(e.message)
    }
  }

  // Los interruptores de este formulario NO se guardan solos (a diferencia del
  // maestro de arriba, que sí). Sin avisarlo, es facilísimo activar "Enviarla
  // al aprobarla", irse, y que no haya surtido efecto.
  const hayCambios = JSON.stringify(form) !== JSON.stringify(guardado)

  const diagnosticar = async () => {
    setDiagnosticando(true)
    try {
      const r = await automationApi.diagnostico()
      setChequeos(r.chequeos)
      if (r.todo_ok) toast.success('Todo correcto')
    } catch (e) {
      toast.error(e.message || 'No se pudo ejecutar el diagnóstico')
    } finally {
      setDiagnosticando(false)
    }
  }

  const clienteElegido = clientes.find((c) => String(c.id) === String(form.client_id))
  const prefijo = user?.transporte_invoice_prefix || 'A'

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      {/* Interruptor principal */}
      {status?.configured && (
        <div style={s.card}>
          <div style={s.switchRow}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600 }}>
                Automatización {status.enabled ? 'activada' : 'desactivada'}
              </div>
              <div style={s.hint}>
                {status.enabled
                  ? `Revisando el correo cada ${form.poll_interval_minutes} min.`
                  : 'Mientras esté desactivada no se revisa el correo.'}
              </div>
            </div>
            <Switch checked={!!status.enabled} onChange={cambiarActiva} />
          </div>
        </div>
      )}

      {/* 1 · Conexión */}
      <Seccion titulo="Conexión" desc="La cuenta de Gmail donde llegan los Excel de viajes.">
        <Campo label="Correo">
          <input
            type="email" value={form.imap_email}
            onChange={(e) => set('imap_email', e.target.value)}
            placeholder="alfredo@gmail.com" style={s.input}
          />
        </Campo>
        <Campo
          label="Contraseña de aplicación"
          hint={tienePassword
            ? 'Ya hay una guardada. Escribe una nueva solo si quieres cambiarla.'
            : 'No es tu contraseña de Gmail: hay que crear una "contraseña de aplicación" en la cuenta de Google.'}
        >
          <input
            type="password" value={form.imap_app_password}
            onChange={(e) => set('imap_app_password', e.target.value)}
            placeholder={tienePassword ? '••••••••••••' : 'xxxx xxxx xxxx xxxx'}
            style={s.input}
          />
        </Campo>
        <div className="form-grid-2">
          <Campo label="Revisar cada" hint="Entre 1 y 60 minutos.">
            <input
              type="number" min="1" max="60" value={form.poll_interval_minutes}
              onChange={(e) => set('poll_interval_minutes', e.target.value)} style={s.input}
            />
          </Campo>
          <div style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: 14 }}>
            <button onClick={probarConexion} disabled={probando} style={s.btnSecondary}>
              {probando ? 'Probando…' : 'Probar conexión'}
            </button>
          </div>
        </div>
      </Seccion>

      {/* 2 · Filtros */}
      <Seccion
        titulo="Qué correos coger"
        desc="Todos los filtros son opcionales. Además, siempre se comprueba que el adjunto sea un Excel con tabla de viajes: ese es el filtro que de verdad evita confusiones."
      >
        <div className="form-grid-2">
          <Campo label="El remitente contiene" hint="Ej. el correo de quien te manda los viajes.">
            <input value={form.sender_filter} onChange={(e) => set('sender_filter', e.target.value)}
                   placeholder="gestor@empresa.com" style={s.input} />
          </Campo>
          <Campo label="El asunto contiene">
            <input value={form.subject_filter} onChange={(e) => set('subject_filter', e.target.value)}
                   placeholder="viajes" style={s.input} />
          </Campo>
        </div>
        <Campo
          label="El nombre del adjunto contiene"
          hint='Parcial, no exacto: "viajes" vale para "viajes agosto.xlsx" y para "VIAJES_2025-08.xlsx".'
        >
          <input value={form.attachment_filter} onChange={(e) => set('attachment_filter', e.target.value)}
                 placeholder="viajes" style={s.input} />
        </Campo>
        <button onClick={probarFiltros} disabled={probandoFiltros} style={s.btnSecondary}>
          {probandoFiltros ? 'Revisando el buzón…' : '🔍 Probar filtros'}
        </button>
        {muestras && (
          <div style={s.muestras}>
            <div style={s.muestrasTitulo}>Últimos correos del buzón:</div>
            {muestras.map((m, i) => (
              <div key={i} style={s.muestra}>
                <span style={m.matches ? s.pill : s.pillOff}>{m.matches ? 'Entra' : 'No'}</span>
                <div style={{ minWidth: 0 }}>
                  <div style={s.muestraAsunto}>{m.subject || '(sin asunto)'}</div>
                  <div style={s.muestraMeta}>{m.from_} · {m.reason}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Seccion>

      {/* 3 · Datos de la factura */}
      <Seccion
        titulo="Datos de la factura"
        desc="Lo que el Excel no trae y hay que fijar aquí una vez."
      >
        <Campo
          label="Cliente"
          hint={clienteElegido && !clienteElegido.email
            ? 'Este cliente no tiene email: para poder enviarle la factura, añádeselo en Clientes o pon un destinatario abajo.'
            : 'Se factura siempre a este cliente. Sus datos saldrán en el PDF.'}
        >
          <div className="select-wrap">
            <select value={form.client_id} onChange={(e) => set('client_id', e.target.value)} style={s.input}>
              <option value="">— Elige un cliente —</option>
              {clientes.map((c) => (
                <option key={c.id} value={c.id}>{c.nombre}{c.is_default ? ' ★' : ''}</option>
              ))}
            </select>
          </div>
        </Campo>

        <Campo
          label="Fecha de la factura"
          hint={form.fecha_origen === 'fin_de_mes'
            ? `Viajes de agosto → factura 31/08 y número ${prefijo}8, aunque el correo llegue en septiembre.`
            : `Atención: viajes de agosto con el correo llegando en septiembre darían número ${prefijo}9 con concepto AGOSTO.`}
        >
          <div className="select-wrap">
            <select value={form.fecha_origen} onChange={(e) => set('fecha_origen', e.target.value)} style={s.input}>
              <option value="fin_de_mes">Último día del mes de los viajes</option>
              <option value="recepcion">Fecha en que llega el correo</option>
            </select>
          </div>
        </Campo>

        <div className="form-grid-2">
          <Campo label="Cabeza tractora por defecto" hint="Solo si el Excel no la trae.">
            <input value={form.default_cabeza} onChange={(e) => set('default_cabeza', e.target.value)} style={s.input} />
          </Campo>
          <Campo label="Cisterna por defecto" hint="Solo si el Excel no la trae.">
            <input value={form.default_cisterna} onChange={(e) => set('default_cisterna', e.target.value)} style={s.input} />
          </Campo>
        </div>
      </Seccion>

      {/* 4 · Qué pasa cuando llega */}
      <Seccion titulo="Cuando llega una factura">
        <Toggle
          checked={form.require_validation}
          onChange={(v) => set('require_validation', v)}
          titulo="Validarla yo antes de guardarla"
          desc={form.require_validation
            ? 'Recomendado: la factura espera en Pendientes a que le des el visto bueno.'
            : 'Se guardará sola. Si falta algún dato o el número ya existe, caerá igualmente a Pendientes.'}
        />
        <Toggle
          checked={form.notify_push}
          onChange={(v) => set('notify_push', v)}
          titulo="Avisarme con una notificación"
          desc="Notificación en el móvil cuando llegue una factura nueva."
        />
        {form.notify_push && <EstadoPush estado={push} onCambiar={cambiarPush} status={status} />}
      </Seccion>

      {/* 5 · Envío */}
      <Seccion titulo="Enviar la factura por email">
        <Toggle
          checked={form.send_on_approve}
          onChange={(v) => set('send_on_approve', v)}
          titulo="Enviarla al aprobarla"
          desc={form.send_on_approve
            ? 'Al aprobar se manda el PDF automáticamente. Enviar un correo no tiene vuelta atrás.'
            : 'Aprobar solo guarda la factura. Recomendado hasta que te fíes del resultado.'}
        />
        {form.send_on_approve && (
          <>
            <Campo
              label="Destinatario"
              hint={clienteElegido?.email && !form.reply_to_email
                ? `Vacío: se usará el email del cliente (${clienteElegido.email}).`
                : 'Déjalo vacío para usar el email de la ficha del cliente.'}
            >
              <input type="email" value={form.reply_to_email}
                     onChange={(e) => set('reply_to_email', e.target.value)}
                     placeholder={clienteElegido?.email || 'facturas@cliente.com'} style={s.input} />
            </Campo>
            <Campo label="Copia a (opcional)">
              <input type="email" value={form.reply_cc_email}
                     onChange={(e) => set('reply_cc_email', e.target.value)} style={s.input} />
            </Campo>
            <Campo label="Asunto" hint="Variables: {numero} {fecha} {total} {cliente} {concepto}">
              <input value={form.reply_subject} onChange={(e) => set('reply_subject', e.target.value)} style={s.input} />
            </Campo>
            <Campo label="Mensaje">
              <textarea value={form.reply_body} onChange={(e) => set('reply_body', e.target.value)}
                        rows={4} style={{ ...s.input, resize: 'vertical' }} />
            </Campo>
          </>
        )}
      </Seccion>

      {/* Diagnóstico: la automatización encadena muchas piezas y, cuando algo
          no llega, sin esto no hay forma de saber cuál falló. */}
      <Seccion
        titulo="Diagnóstico"
        desc="Comprueba de una pasada todos los pasos: la conexión con el correo, el cliente, el envío y las notificaciones."
      >
        <button onClick={diagnosticar} disabled={diagnosticando} style={s.btnSecondary}>
          {diagnosticando ? 'Comprobando…' : '🩺 Comprobar todo'}
        </button>
        {chequeos && (
          <div style={{ marginTop: 14, display: 'grid', gap: 10 }}>
            {chequeos.map((c) => (
              <div key={c.clave} style={s.chequeo}>
                <span style={s.icono[c.estado]}>
                  {c.estado === 'ok' ? '✓' : c.estado === 'aviso' ? '!' : '✕'}
                </span>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{c.titulo}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{c.detalle}</div>
                  {c.ayuda && <div style={s.ayuda}>→ {c.ayuda}</div>}
                </div>
              </div>
            ))}
          </div>
        )}
      </Seccion>

      <div className={'autom-guardar' + (hayCambios ? ' pendiente' : '')}>
        {hayCambios && (
          <span style={s.avisoCambios}>⬤ Cambios sin guardar</span>
        )}
        <button
          onClick={guardar}
          disabled={guardando || !hayCambios}
          style={hayCambios ? s.btnPrimary : s.btnPrimaryOff}
        >
          {guardando ? 'Guardando…' : hayCambios ? 'Guardar configuración' : 'Todo guardado'}
        </button>
      </div>
    </div>
  )
}

function EstadoPush({ estado, onCambiar, status }) {
  if (!status?.push_available) {
    return <div style={s.avisoPush}>El servidor no tiene configuradas las notificaciones.</div>
  }
  if (estado === 'requiere-instalar') {
    return (
      <div style={s.avisoPush}>
        En iPhone las notificaciones solo llegan si añades la app a la pantalla de inicio:
        toca <strong>Compartir</strong> → <strong>Añadir a pantalla de inicio</strong>, y vuelve aquí.
      </div>
    )
  }
  if (estado === 'no-soportado') {
    return <div style={s.avisoPush}>Este navegador no admite notificaciones.</div>
  }
  if (estado === 'denegado') {
    return (
      <div style={s.avisoPush}>
        Bloqueaste las notificaciones para esta app. Hay que volver a permitirlas
        desde los ajustes del navegador.
      </div>
    )
  }
  return (
    <div style={s.filaPush}>
      <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
        {estado === 'activo'
          ? 'Este dispositivo recibe notificaciones.'
          : 'Este dispositivo aún no recibe notificaciones.'}
      </span>
      <div style={{ display: 'flex', gap: 8 }}>
        {estado === 'activo' && (
          <button onClick={() => automationApi.pushTest().catch(() => {})} style={s.btnMini}>
            Probar
          </button>
        )}
        <button onClick={onCambiar} style={s.btnMini}>
          {estado === 'activo' ? 'Desactivar aquí' : 'Activar aquí'}
        </button>
      </div>
    </div>
  )
}

function Seccion({ titulo, desc, children }) {
  return (
    <div style={s.card}>
      <div style={s.seccionTitulo}>{titulo}</div>
      {desc && <p style={s.seccionDesc}>{desc}</p>}
      {children}
    </div>
  )
}

function Campo({ label, hint, children }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={s.label}>{label}</label>
      {children}
      {hint && <div style={s.hint}>{hint}</div>}
    </div>
  )
}

function Toggle({ checked, onChange, titulo, desc }) {
  return (
    <div style={s.switchRow}>
      <div style={{ minWidth: 0, paddingRight: 12 }}>
        <div style={{ fontSize: 14, fontWeight: 600 }}>{titulo}</div>
        {desc && <div style={s.hint}>{desc}</div>}
      </div>
      <Switch checked={checked} onChange={onChange} />
    </div>
  )
}

function Switch({ checked, onChange }) {
  return (
    <button
      role="switch" aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={'autom-switch' + (checked ? ' on' : '')}
    >
      <span className="autom-switch-knob" />
    </button>
  )
}

const s = {
  card: { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-card)', padding: '20px 22px' },
  seccionTitulo: { fontSize: 12, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 6 },
  seccionDesc: { fontSize: 12, color: 'var(--text-muted)', margin: '0 0 16px', lineHeight: 1.6 },
  label: { display: 'block', fontSize: 12, fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 6 },
  input: { width: '100%', background: 'var(--surface-3)', border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', padding: '9px 12px', color: 'var(--text)', fontFamily: 'var(--font-ui)', fontSize: 14, outline: 'none', boxSizing: 'border-box' },
  hint: { fontSize: 11, color: 'var(--text-muted)', marginTop: 5, lineHeight: 1.5 },
  switchRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '10px 0', borderBottom: '1px solid var(--border-soft)' },
  muestras: { marginTop: 14, display: 'grid', gap: 8 },
  muestrasTitulo: { fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 },
  muestra: { display: 'flex', gap: 10, alignItems: 'flex-start', fontSize: 12 },
  muestraAsunto: { fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  muestraMeta: { color: 'var(--text-muted)', fontSize: 11, marginTop: 2 },
  pill: { fontSize: 10, fontWeight: 600, color: 'var(--menta)', background: 'rgba(69,212,155,0.12)', border: '1px solid rgba(69,212,155,0.3)', borderRadius: 999, padding: '2px 8px', flexShrink: 0 },
  pillOff: { fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', background: 'var(--surface-3)', border: '1px solid var(--border)', borderRadius: 999, padding: '2px 8px', flexShrink: 0 },
  avisoPush: { fontSize: 12, color: 'var(--cielo)', background: 'rgba(111,168,255,0.08)', border: '1px solid rgba(111,168,255,0.25)', borderRadius: 'var(--r-sm)', padding: '10px 12px', marginTop: 10, lineHeight: 1.6 },
  filaPush: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginTop: 10, flexWrap: 'wrap' },
  btnMini: { padding: '5px 12px', background: 'var(--btn-soft)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', fontSize: 12, cursor: 'pointer', fontFamily: 'var(--font-ui)' },
  chequeo: { display: 'flex', gap: 10, alignItems: 'flex-start' },
  ayuda: { fontSize: 12, color: 'var(--cielo)', marginTop: 4, lineHeight: 1.5 },
  icono: {
    ok: { flexShrink: 0, width: 20, height: 20, borderRadius: '50%', background: 'rgba(69,212,155,0.15)', color: 'var(--menta)', fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' },
    aviso: { flexShrink: 0, width: 20, height: 20, borderRadius: '50%', background: 'rgba(232,184,75,0.15)', color: '#E8B84B', fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' },
    error: { flexShrink: 0, width: 20, height: 20, borderRadius: '50%', background: 'rgba(240,135,106,0.15)', color: 'var(--coral)', fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' },
  },
  avisoCambios: { fontSize: 12, fontWeight: 600, color: '#E8B84B' },
  btnPrimaryOff: { padding: '11px 24px', background: 'var(--surface-3)', color: 'var(--text-muted)', border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', fontFamily: 'var(--font-ui)', fontSize: 14, fontWeight: 600, cursor: 'default' },
  btnPrimary: { padding: '11px 24px', background: 'var(--menta)', color: 'var(--ink)', border: 'none', borderRadius: 'var(--r-sm)', fontFamily: 'var(--font-ui)', fontSize: 14, fontWeight: 600, cursor: 'pointer' },
  btnSecondary: { padding: '9px 16px', background: 'var(--btn-soft)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', fontFamily: 'var(--font-ui)', fontSize: 13, cursor: 'pointer' },
}
