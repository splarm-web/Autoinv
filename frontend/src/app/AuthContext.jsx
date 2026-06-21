import { createContext, useContext, useEffect, useState } from 'react'
import { authApi } from '../lib/api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const stored = localStorage.getItem('autoinv_user')
      return stored ? JSON.parse(stored) : null
    } catch {
      return null
    }
  })

  // Al cargar, si hay sesión, refrescamos el usuario desde /me para tener
  // las features actualizadas (p. ej. si cambian los permisos en el servidor).
  useEffect(() => {
    const token = localStorage.getItem('autoinv_token')
    if (!token) return
    authApi.me()
      .then((u) => {
        localStorage.setItem('autoinv_user', JSON.stringify(u))
        setUser(u)
      })
      .catch(() => {})
  }, [])

  const login = (token, userData) => {
    localStorage.setItem('autoinv_token', token)
    localStorage.setItem('autoinv_user', JSON.stringify(userData))
    setUser(userData)
  }

  const logout = () => {
    localStorage.removeItem('autoinv_token')
    localStorage.removeItem('autoinv_user')
    setUser(null)
  }

  const updateUser = (patch) => {
    const updated = { ...user, ...patch }
    localStorage.setItem('autoinv_user', JSON.stringify(updated))
    setUser(updated)
  }

  const hasFeature = (key) =>
    Array.isArray(user?.features) ? user.features.includes(key) : false

  return (
    <AuthContext.Provider value={{ user, login, logout, updateUser, hasFeature }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
