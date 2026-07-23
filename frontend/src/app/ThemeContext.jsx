import { createContext, useCallback, useContext, useEffect, useState } from 'react'

/**
 * Tema claro/oscuro.
 *
 * El tema inicial ya lo aplica un script en index.html (antes del primer
 * pintado, para evitar el flash). Aquí solo lo leemos y lo mantenemos.
 * Si el usuario no ha elegido nada, seguimos la preferencia del sistema
 * y reaccionamos a sus cambios en vivo.
 */

const ThemeCtx = createContext(null)
export const useTheme = () => useContext(ThemeCtx)

const STORAGE_KEY = 'autoinv_theme'

const systemTheme = () =>
  window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme
  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta) meta.setAttribute('content', theme === 'light' ? '#F4F6F8' : '#0E1014')
}

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(
    () => document.documentElement.dataset.theme || 'dark',
  )

  // Sin preferencia explícita → seguir al sistema si cambia
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: light)')
    const onChange = () => {
      if (!localStorage.getItem(STORAGE_KEY)) {
        const next = systemTheme()
        applyTheme(next)
        setTheme(next)
      }
    }
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  const setThemeAndStore = useCallback((next) => {
    localStorage.setItem(STORAGE_KEY, next)
    applyTheme(next)
    setTheme(next)
  }, [])

  const toggleTheme = useCallback(() => {
    setThemeAndStore(theme === 'light' ? 'dark' : 'light')
  }, [theme, setThemeAndStore])

  // Vuelve a "automático" (sigue al sistema)
  const useSystemTheme = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY)
    const next = systemTheme()
    applyTheme(next)
    setTheme(next)
  }, [])

  return (
    <ThemeCtx.Provider value={{ theme, setTheme: setThemeAndStore, toggleTheme, useSystemTheme }}>
      {children}
    </ThemeCtx.Provider>
  )
}
