import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { authApi } from '../../lib/api'
import { useAuth } from '../../app/AuthContext'
import { Logo } from '../../components/AppShell'
import './auth.css'

export default function RegisterPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({ email: '', password: '', legal_name: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handle = (e) => setForm({ ...form, [e.target.name]: e.target.value })

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    if (form.password.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres')
      return
    }
    setLoading(true)
    try {
      const res = await authApi.register(form)
      login(res.access_token, res.user)
      navigate('/settings')  // ir a ajustes para completar datos fiscales
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-logo"><Logo /></div>
        <h1 className="auth-title">Crea tu cuenta</h1>
        <p className="auth-subtitle">Empieza a gestionar tu facturación</p>

        {error && <div className="auth-error">{error}</div>}

        <form onSubmit={submit}>
          <div className="field">
            <label htmlFor="legal_name">Nombre o razón social <span style={{ opacity: 0.5, fontWeight: 400 }}>(opcional)</span></label>
            <input
              id="legal_name"
              name="legal_name"
              type="text"
              value={form.legal_name}
              onChange={handle}
              placeholder="Laura Méndez Castro"
            />
          </div>
          <div className="field">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              value={form.email}
              onChange={handle}
              placeholder="tu@email.com"
            />
          </div>
          <div className="field">
            <label htmlFor="password">Contraseña</label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="new-password"
              required
              value={form.password}
              onChange={handle}
              placeholder="Mínimo 8 caracteres"
            />
          </div>
          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? 'Creando cuenta…' : 'Crear cuenta'}
          </button>
        </form>

        <div className="auth-link">
          ¿Ya tienes cuenta? <Link to="/login">Inicia sesión</Link>
        </div>
      </div>
    </div>
  )
}
