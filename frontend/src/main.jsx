import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { AuthProvider } from './app/AuthContext'
import { ThemeProvider } from './app/ThemeContext'
import { DensityProvider } from './app/DensityContext'
import { ToastProvider } from './components/Toast'
import AppRouter from './app/router'
import { vigilarActualizaciones } from './lib/actualizacion'
import './styles/tokens.css'
import './styles/buttons.css'
import './styles/density.css'
import './styles/responsive.css'

vigilarActualizaciones()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <ThemeProvider>
        <DensityProvider>
          <ToastProvider>
            <AuthProvider>
              <AppRouter />
            </AuthProvider>
          </ToastProvider>
        </DensityProvider>
      </ThemeProvider>
    </BrowserRouter>
  </StrictMode>
)
