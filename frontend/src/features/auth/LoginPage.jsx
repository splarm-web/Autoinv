import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { authApi } from '../../lib/api'
import { useAuth } from '../../app/AuthContext'
import { Logo } from '../../components/AppShell'
import './auth.css'

export default function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({ email: '', password: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handle = (e) => setForm({ ...form, [e.target.name]: e.target.value })

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await authApi.login(form)
      login(res.access_token, res.user)
      navigate('/dashboard')
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
        <h1 className="auth-title">Bienvenido de nuevo</h1>
        <p className="auth-subtitle">Accede a tu cuenta de autoinv</p>

        {error && <div className="auth-error">{error}</div>}

        <form onSubmit={submit}>
          <div className="field">
            <label htmlFor="email">Usuario</label>
            <input
              id="email"
              name="email"
              type="text"
              autoComplete="username"
              required
              value={form.email}
              onChange={handle}
              placeholder="sergio"
            />
          </div>
          <div className="field">
            <label htmlFor="password">Contraseña</label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              value={form.password}
              onChange={handle}
              placeholder="••••••••"
            />
          </div>
          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? 'Entrando…' : 'Entrar'}
          </button>
        </form>

        <div className="auth-link">
          ¿Sin cuenta? <Link to="/register">Regístrate gratis</Link>
        </div>
      </div>
    </div>
  )
}
