import { useEffect, useState } from 'react'
import { adminApi } from '../../lib/api'
import { useAuth } from '../../app/AuthContext'
import { useToast } from '../../components/Toast'

export default function AdminPage() {
  const { user, updateUser } = useAuth()
  const { toast } = useToast()
  const [catalog, setCatalog] = useState([])
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [savingId, setSavingId] = useState(null)
  const [savedId, setSavedId] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    Promise.all([adminApi.featuresCatalog(), adminApi.listUsers()])
      .then(([cat, us]) => { setCatalog(cat); setUsers(us) })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  const toggle = (userId, key) => {
    setSavedId(null)
    setUsers((prev) => prev.map((u) => {
      if (u.id !== userId) return u
      const has = u.features.includes(key)
      return { ...u, features: has ? u.features.filter((f) => f !== key) : [...u.features, key] }
    }))
  }

  const save = async (u) => {
    setError(''); setSavingId(u.id)
    try {
      const updated = await adminApi.setUserFeatures(u.id, u.features)
      setUsers((prev) => prev.map((x) => (x.id === u.id ? updated : x)))
      setSavedId(u.id)
      toast.success(`Funciones de ${updated.legal_name || updated.email} guardadas`)
      // Si me edito a mí mismo, refresco mi sesión (nav/permisos)
      if (u.id === user?.id) updateUser(updated)
    } catch (e) {
      setError(e.message || 'No se pudo guardar')
      toast.error(e.message || 'No se pudo guardar')
    } finally {
      setSavingId(null)
    }
  }

  return (
    <div style={{ maxWidth: 760 }}>
      <h1 style={s.title}>Administración</h1>
      <p style={s.subtitle}>Gestiona qué funciones tiene activadas cada usuario.</p>

      {error && <div style={s.error}>{error}</div>}

      {loading ? (
        <div style={{ color: 'var(--text-muted)', fontSize: 14 }}>Cargando…</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {users.map((u) => (
            <div key={u.id} style={s.card}>
              <div style={s.userRow}>
                <div>
                  <div style={s.userName}>
                    {u.legal_name || u.email}
                    {u.id === user?.id && <span style={s.youBadge}>tú</span>}
                  </div>
                  <div style={s.userMail}>{u.email}</div>
                </div>
                <button
                  onClick={() => save(u)}
                  disabled={savingId === u.id}
                  style={savedId === u.id ? s.savedBtn : s.saveBtn}
                >
                  {savingId === u.id ? 'Guardando…' : savedId === u.id ? '✓ Guardado' : 'Guardar'}
                </button>
              </div>

              <div style={s.chipRow}>
                {catalog.map((f) => {
                  const active = u.features.includes(f.key)
                  return (
                    <button
                      key={f.key}
                      onClick={() => toggle(u.id, f.key)}
                      style={active ? s.chipActive : s.chip}
                    >
                      {active ? '✓ ' : ''}{f.label}
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

const s = {
  title: { fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 22, margin: '0 0 6px', letterSpacing: '-0.01em' },
  subtitle: { fontSize: 14, color: 'var(--text-muted)', margin: '0 0 24px' },
  error: { color: 'var(--coral)', fontSize: 13, marginBottom: 14, padding: '10px 14px', border: '1px solid rgba(240,135,106,0.3)', borderRadius: 'var(--r-sm)', background: 'var(--surface)' },
  card: { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-card)', padding: '18px 20px' },
  userRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16, gap: 12 },
  userName: { fontSize: 15, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 },
  userMail: { fontSize: 12, color: 'var(--text-muted)', marginTop: 2 },
  youBadge: { fontSize: 10, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--cielo)', background: 'rgba(111,168,255,0.12)', border: '1px solid rgba(111,168,255,0.25)', borderRadius: 999, padding: '2px 8px' },
  chipRow: { display: 'flex', gap: 8, flexWrap: 'wrap' },
  chip: { background: 'var(--surface-3)', border: '1px solid var(--border)', color: 'var(--text-muted)', borderRadius: 'var(--r-sm)', padding: '7px 13px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-ui)' },
  chipActive: { background: 'rgba(69,212,155,0.14)', border: '1px solid rgba(69,212,155,0.4)', color: 'var(--menta)', borderRadius: 'var(--r-sm)', padding: '7px 13px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-ui)' },
  saveBtn: { padding: '8px 16px', background: 'var(--menta)', color: 'var(--ink)', border: 'none', borderRadius: 'var(--r-sm)', fontWeight: 600, fontSize: 13, cursor: 'pointer', fontFamily: 'var(--font-ui)', flexShrink: 0 },
  savedBtn: { padding: '8px 16px', background: 'rgba(69,212,155,0.14)', color: 'var(--menta)', border: '1px solid rgba(69,212,155,0.3)', borderRadius: 'var(--r-sm)', fontWeight: 600, fontSize: 13, cursor: 'pointer', fontFamily: 'var(--font-ui)', flexShrink: 0 },
}
