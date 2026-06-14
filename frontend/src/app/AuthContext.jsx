import { createContext, useContext, useState } from 'react'

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

  return (
    <AuthContext.Provider value={{ user, login, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
