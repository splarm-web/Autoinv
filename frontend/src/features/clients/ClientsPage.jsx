import { useEffect, useRef, useState } from 'react'
import { clientsApi } from '../../lib/api'
import '../../styles/modal.css'
import './clients.css'

export default function ClientsPage() {
  const [clients, setClients] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null) // null | 'new' | client_object

  useEffect(() => {
    load()
  }, [])

  const load = () => {
    setLoading(true)
    clientsApi.list().then(setClients).finally(() => setLoading(false))
  }

  const handleSave = (saved) => {
    setClients((prev) => {
      const updated = saved.is_default
        ? prev.map((c) => ({ ...c, is_default: c.id === saved.id ? true : false }))
        : prev
      const exists = updated.find((c) => c.id === saved.id)
      return exists
        ? updated.map((c) => (c.id === saved.id ? saved : c))
        : [saved, ...updated].sort((a, b) => b.is_default - a.is_default || a.nombre.localeCompare(b.nombre))
    })
    setModal(null)
  }

  const handleSetDefault = async (id) => {
    const updated = await clientsApi.setDefault(id)
    setClients((prev) =>
      prev
        .map((c) => ({ ...c, is_default: c.id === id }))
        .sort((a, b) => b.is_default - a.is_default || a.nombre.localeCompare(b.nombre))
    )
  }

  const handleDelete = async (id) => {
    if (!confirm('¿Eliminar este cliente?')) return
    await clientsApi.delete(id)
    setClients((prev) => prev.filter((c) => c.id !== id))
  }

  return (
    <div className="clients-root">
      <div className="clients-header">
        <h1 className="clients-title">Clientes</h1>
        <button className="btn-primary fab-add" onClick={() => setModal('new')}>
          <span className="fab-icon">+</span><span className="fab-label"> Añadir cliente</span>
        </button>
      </div>

      {loading ? (
        <div className="clients-loading">Cargando…</div>
      ) : clients.length === 0 ? (
        <EmptyState onAdd={() => setModal('new')} />
      ) : (
        <div className="clients-list">
          {clients.map((client) => (
            <ClientCard
              key={client.id}
              client={client}
              onEdit={() => setModal(client)}
              onSetDefault={() => handleSetDefault(client.id)}
              onDelete={() => handleDelete(client.id)}
            />
          ))}
        </div>
      )}

      {modal !== null && (
        <ClientModal
          client={modal === 'new' ? null : modal}
          onSave={handleSave}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  )
}

function ClientCard({ client, onEdit, onSetDefault, onDelete }) {
  return (
    <div className={`client-card${client.is_default ? ' client-card--default' : ''}`}>
      <div className="client-card-left">
        <div className="client-card-avatar">
          {client.nombre.charAt(0).toUpperCase()}
        </div>
        <div className="client-card-info">
          <div className="client-card-name">
            {client.nombre}
            {client.is_default && <span className="badge-principal">Principal</span>}
          </div>
          <div className="client-card-meta">
            {[client.cif, client.ciudad].filter(Boolean).join(' · ')}
          </div>
          {client.direccion && (
            <div className="client-card-dir">{client.direccion}</div>
          )}
        </div>
      </div>
      <div className="client-card-actions">
        {!client.is_default && (
          <button
            className="client-action-btn"
            onClick={onSetDefault}
            title="Marcar como principal"
          >
            <IconStar />
          </button>
        )}
        <button className="client-action-btn" onClick={onEdit} title="Editar">
          <IconEdit />
        </button>
        <button
          className="client-action-btn client-action-btn--danger"
          onClick={onDelete}
          title="Eliminar"
        >
          <IconTrash />
        </button>
      </div>
    </div>
  )
}

function ClientModal({ client, onSave, onClose }) {
  const isEdit = !!client
  const [form, setForm] = useState({
    nombre: client?.nombre ?? '',
    cif: client?.cif ?? '',
    direccion: client?.direccion ?? '',
    ciudad: client?.ciudad ?? '',
    email: client?.email ?? '',
    notas: client?.notas ?? '',
    is_default: client?.is_default ?? false,
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const firstRef = useRef(null)

  useEffect(() => {
    firstRef.current?.focus()
  }, [])

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.nombre.trim()) { setError('El nombre es obligatorio'); return }
    setSaving(true)
    setError(null)
    try {
      const payload = {
        ...form,
        nombre: form.nombre.trim(),
        cif: form.cif.trim() || null,
        direccion: form.direccion.trim() || null,
        ciudad: form.ciudad.trim() || null,
        email: form.email.trim() || null,
        notas: form.notas.trim() || null,
      }
      const saved = isEdit
        ? await clientsApi.update(client.id, payload)
        : await clientsApi.create(payload)
      onSave(saved)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-panel">
        <div className="modal-header">
          <h2 className="modal-title">{isEdit ? 'Editar cliente' : 'Nuevo cliente'}</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <form className="modal-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Nombre / Razón social *</label>
            <input
              ref={firstRef}
              className="form-input"
              value={form.nombre}
              onChange={(e) => set('nombre', e.target.value)}
              placeholder="Empresa S.L."
            />
          </div>

          <div className="form-group">
            <label className="form-label">CIF / NIF</label>
            <input
              className="form-input"
              value={form.cif}
              onChange={(e) => set('cif', e.target.value)}
              placeholder="B-12.345.678"
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Dirección</label>
              <input
                className="form-input"
                value={form.direccion}
                onChange={(e) => set('direccion', e.target.value)}
                placeholder="C/ Ejemplo 12, 1º"
              />
            </div>
            <div className="form-group">
              <label className="form-label">Ciudad / CP</label>
              <input
                className="form-input"
                value={form.ciudad}
                onChange={(e) => set('ciudad', e.target.value)}
                placeholder="46000 Valencia"
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Email</label>
            <input
              className="form-input"
              type="email"
              value={form.email}
              onChange={(e) => set('email', e.target.value)}
              placeholder="facturas@empresa.com"
            />
            <div className="form-hint">
              Destinatario por defecto al enviarle facturas por email.
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Notas internas</label>
            <textarea
              className="form-input form-textarea"
              value={form.notas}
              onChange={(e) => set('notas', e.target.value)}
              placeholder="Condiciones de pago, contacto, etc."
              rows={2}
            />
          </div>

          <label className="form-toggle">
            <input
              type="checkbox"
              checked={form.is_default}
              onChange={(e) => set('is_default', e.target.checked)}
            />
            <span className="form-toggle-track">
              <span className="form-toggle-thumb" />
            </span>
            <span className="form-toggle-label">Marcar como cliente principal</span>
          </label>

          {error && <div className="form-error">{error}</div>}

          <div className="modal-footer">
            <button type="button" className="btn-ghost" onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? 'Guardando…' : isEdit ? 'Guardar cambios' : 'Añadir cliente'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function EmptyState({ onAdd }) {
  return (
    <div className="clients-empty">
      <div className="clients-empty-icon">
        <IconBuilding />
      </div>
      <div className="clients-empty-title">Sin clientes todavía</div>
      <div className="clients-empty-desc">
        Añade tus clientes para seleccionarlos rápidamente al crear facturas.<br />
        Puedes marcar uno como principal y se usará por defecto.
      </div>
      <button className="btn-primary" onClick={onAdd}>
        + Añadir primer cliente
      </button>
    </div>
  )
}

// ── Icons ──

function IconStar() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
      <path d="M7.5 1.5l1.545 3.13 3.455.502-2.5 2.437.59 3.44L7.5 9.387 4.91 10.009l.59-3.44L3 4.132l3.455-.502L7.5 1.5z"
        stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
    </svg>
  )
}

function IconEdit() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path d="M9.5 2.5l2 2-7 7H2.5v-2l7-7z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
    </svg>
  )
}

function IconTrash() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path d="M2 3.5h10M5.5 3.5V2h3v1.5M4 3.5l.7 8h4.6l.7-8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function IconBuilding() {
  return (
    <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
      <rect x="6" y="8" width="28" height="26" rx="3" stroke="currentColor" strokeWidth="2" />
      <path d="M14 34V22h12v12" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <rect x="12" y="13" width="4" height="4" rx="1" fill="currentColor" opacity=".5" />
      <rect x="24" y="13" width="4" height="4" rx="1" fill="currentColor" opacity=".5" />
    </svg>
  )
}
