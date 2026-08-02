import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../app/AuthContext'
import { useTheme } from '../app/ThemeContext'
import { automationApi } from '../lib/api'
import '../styles/modal.css'
import './AppShell.css'

// `feature`: exige esa función. `anyFeature`: basta con tener una. Sin nada: siempre.
const NAV = [
  { to: '/dashboard', label: 'Resumen',  Icon: IconResumen },
  { to: '/expenses',  label: 'Gastos',   Icon: IconGastos,   feature: 'gastos' },
  { to: '/invoices',  label: 'Facturas', Icon: IconFacturas, anyFeature: ['facturas', 'transporte'] },
  { to: '/clients',   label: 'Clientes', Icon: IconClientes, feature: 'clientes' },
  { to: '/admin',     label: 'Admin',    Icon: IconAdmin,    feature: 'admin' },
  { to: '/settings',  label: 'Ajustes',  Icon: IconAjustes },
]

function navAllowed(item, hasFeature) {
  if (item.feature) return hasFeature(item.feature)
  if (item.anyFeature) return item.anyFeature.some(hasFeature)
  return true
}

// Título de la barra móvil según la sección activa (p.ej. /invoices/new → "Facturas").
function sectionTitle(pathname) {
  const match = [...NAV].sort((a, b) => b.to.length - a.to.length).find((n) => pathname.startsWith(n.to))
  return match?.label || 'autoinv'
}

/**
 * Contador de facturas pendientes de validar, para el badge del menú.
 *
 * Se refresca cada minuto y, además, al vuelo cuando la propia página de
 * Automatización aprueba o descarta algo (evento `automation:changed`): sin
 * eso el badge seguiría marcando facturas que el usuario acaba de resolver.
 */
function usePendingCount(activo) {
  const [count, setCount] = useState(0)

  useEffect(() => {
    if (!activo) { setCount(0); return }
    let vivo = true
    const cargar = () => automationApi.status()
      .then((s) => { if (vivo) setCount(s.pending_count || 0) })
      .catch(() => {})

    cargar()
    const id = setInterval(cargar, 60000)
    window.addEventListener('automation:changed', cargar)
    return () => {
      vivo = false
      clearInterval(id)
      window.removeEventListener('automation:changed', cargar)
    }
  }, [activo])

  return count
}

export default function AppShell() {
  const { user, logout, hasFeature } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [accountOpen, setAccountOpen] = useState(false)
  const pendingCount = usePendingCount(hasFeature('automatizacion'))

  // Bottom bar móvil = navegación primaria completa salvo Admin, que va al
  // panel de cuenta (es cosa de un único usuario, no merece hueco fijo para
  // todos). Nada que mantener sincronizado: se deriva directamente de NAV.
  const bottomNav = NAV.filter((item) => item.to !== '/admin' && navAllowed(item, hasFeature))

  const initials = (user?.legal_name || user?.email || 'U')
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase()

  const handleLogout = () => { logout(); navigate('/login') }

  return (
    <div className="shell-root">
      {/* Desktop sidebar */}
      <aside className="shell-sidebar">
        <SidebarContent initials={initials} user={user} onLogout={handleLogout} hasFeature={hasFeature} pendingCount={pendingCount} />
      </aside>

      {/* Content */}
      <div className="shell-content">
        <div className="shell-mobile-bar">
          <span className="shell-page-title">{sectionTitle(location.pathname)}</span>
          <button className="shell-avatar-btn" onClick={() => setAccountOpen(true)} aria-label="Cuenta">
            {initials}
          </button>
        </div>
        <main className="shell-main">
          <Outlet />
        </main>
      </div>

      {/* Mobile bottom nav: navegación primaria completa */}
      <nav className="shell-bottom-nav">
        {bottomNav.map(({ to, label, Icon }) => (
          <NavLink key={to} to={to} className={({ isActive }) =>
            'bottom-nav-item' + (isActive ? ' active' : '')
          }>
            <span className="nav-icon-wrap">
              <Icon />
              {to === '/invoices' && pendingCount > 0 && (
                <span className="nav-badge">{pendingCount}</span>
              )}
            </span>
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>

      {/* Panel de cuenta (móvil): lo que no cabe en la bottom bar — Admin
          (si aplica), tema y cerrar sesión. Único destino del avatar. */}
      {accountOpen && (
        <AccountSheet
          user={user}
          initials={initials}
          hasFeature={hasFeature}
          navigate={navigate}
          onClose={() => setAccountOpen(false)}
          onLogout={handleLogout}
        />
      )}
    </div>
  )
}

function AccountSheet({ user, initials, hasFeature, navigate, onClose, onLogout }) {
  const { theme, toggleTheme } = useTheme()
  const isLight = theme === 'light'

  const go = (to) => { onClose(); navigate(to) }

  return (
    <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-panel">
        <div className="modal-header">
          <h2 className="modal-title">Cuenta</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="account-sheet-body">
          <div className="account-sheet-user">
            <div className="shell-avatar">{initials}</div>
            <div style={{ minWidth: 0 }}>
              <div className="account-sheet-name">{user?.legal_name || user?.email?.split('@')[0]}</div>
              <div className="account-sheet-plan">Autónomo</div>
            </div>
          </div>

          {hasFeature('admin') && (
            <button className="account-sheet-row" onClick={() => go('/admin')}>
              <IconAdmin /> Administración
            </button>
          )}

          <button className="account-sheet-row" onClick={toggleTheme}>
            {isLight ? <IconMoon /> : <IconSun />}
            {isLight ? 'Tema oscuro' : 'Tema claro'}
          </button>

          <button className="account-sheet-row account-sheet-row--danger" onClick={onLogout}>
            <IconLogout /> Cerrar sesión
          </button>
        </div>
      </div>
    </div>
  )
}

function SidebarContent({ initials, user, onLogout, onNavClick, hasFeature, pendingCount = 0 }) {
  const items = NAV.filter((item) => navAllowed(item, hasFeature))
  return (
    <div className="shell-sidebar-inner">
      <div className="shell-logo-wrap">
        <Logo />
      </div>
      <nav className="shell-nav">
        {items.map(({ to, label, Icon }) => (
          <NavLink
            key={to}
            to={to}
            onClick={onNavClick}
            className={({ isActive }) => 'nav-item' + (isActive ? ' active' : '')}
          >
            <Icon />
            {label}
            {to === '/invoices' && pendingCount > 0 && (
              <span className="nav-badge nav-badge--inline">{pendingCount}</span>
            )}
          </NavLink>
        ))}
      </nav>
      <div className="shell-user">
        <div className="shell-avatar">{initials}</div>
        <div style={{ lineHeight: 1.3, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {user?.legal_name || user?.email?.split('@')[0]}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Autónomo</div>
        </div>
        <ThemeToggle className="shell-theme" />
        <button className="shell-logout" onClick={onLogout} title="Cerrar sesión">
          <IconLogout />
        </button>
      </div>
    </div>
  )
}

function ThemeToggle({ className }) {
  const { theme, toggleTheme } = useTheme()
  const isLight = theme === 'light'
  return (
    <button
      className={className}
      onClick={toggleTheme}
      title={isLight ? 'Cambiar a tema oscuro' : 'Cambiar a tema claro'}
      aria-label={isLight ? 'Cambiar a tema oscuro' : 'Cambiar a tema claro'}
    >
      {isLight ? <IconMoon /> : <IconSun />}
    </button>
  )
}

export function Logo() {
  return (
    <div className="logo-wrap">
      <div className="logo-mark">a</div>
      <span className="logo-text">
        auto<span style={{ color: 'var(--menta)' }}>inv</span>
      </span>
    </div>
  )
}

// ── SVG Icons ──

function IconResumen() {
  return (
    <svg width="18" height="18" viewBox="0 0 15 15" fill="none">
      <rect x="1" y="1" width="5.5" height="5.5" rx="1.5" fill="currentColor" />
      <rect x="8.5" y="1" width="5.5" height="5.5" rx="1.5" fill="currentColor" />
      <rect x="1" y="8.5" width="5.5" height="5.5" rx="1.5" fill="currentColor" />
      <rect x="8.5" y="8.5" width="5.5" height="5.5" rx="1.5" fill="currentColor" />
    </svg>
  )
}
function IconGastos() {
  return (
    <svg width="18" height="18" viewBox="0 0 15 15" fill="none">
      <path d="M7.5 1v13M2 5l5.5 5.5L13 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
function IconFacturas() {
  return (
    <svg width="18" height="18" viewBox="0 0 15 15" fill="none">
      <rect x="2" y="1" width="11" height="13" rx="2" stroke="currentColor" strokeWidth="1.4" />
      <path d="M5 5h5M5 7.5h5M5 10h3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  )
}
function IconClientes() {
  return (
    <svg width="18" height="18" viewBox="0 0 15 15" fill="none">
      <circle cx="5.5" cy="4.5" r="2.5" stroke="currentColor" strokeWidth="1.4" />
      <path d="M1 13c0-2.5 2-4 4.5-4s4.5 1.5 4.5 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M10.5 6.5c1.5 0 2.5 1 2.5 2.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <circle cx="10.5" cy="3.5" r="1.5" stroke="currentColor" strokeWidth="1.3" />
    </svg>
  )
}
function IconAdmin() {
  return (
    <svg width="18" height="18" viewBox="0 0 15 15" fill="none">
      <circle cx="7.5" cy="4" r="2.5" stroke="currentColor" strokeWidth="1.4" />
      <path d="M2 13c0-3 2.5-4.5 5.5-4.5S13 10 13 13" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M11.5 2.5l.6 1.2 1.3.2-.95.9.22 1.3-1.17-.62-1.17.62.22-1.3-.95-.9 1.3-.2z" fill="currentColor" />
    </svg>
  )
}
function IconAjustes() {
  // Tuerca hexagonal, no radios: el diseño anterior (círculo + 8 radios) era
  // visualmente casi idéntico al icono del sol (tema), y se confundían en
  // el mismo sidebar.
  return (
    <svg width="18" height="18" viewBox="0 0 15 15" fill="none">
      <path d="M7.5 1L13 4.2v6.6L7.5 14 2 10.8V4.2L7.5 1z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
      <circle cx="7.5" cy="7.5" r="2.1" stroke="currentColor" strokeWidth="1.3" />
    </svg>
  )
}
function IconLogout() {
  return (
    <svg width="17" height="17" viewBox="0 0 14 14" fill="none">
      <path d="M5 1H2a1 1 0 00-1 1v10a1 1 0 001 1h3M9 10l3-3-3-3M12 7H5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
function IconSun() {
  return (
    <svg width="18" height="18" viewBox="0 0 15 15" fill="none">
      <circle cx="7.5" cy="7.5" r="3" stroke="currentColor" strokeWidth="1.4" />
      <path d="M7.5 .8v1.7M7.5 12.5v1.7M.8 7.5h1.7M12.5 7.5h1.7M2.75 2.75l1.2 1.2M11.05 11.05l1.2 1.2M2.75 12.25l1.2-1.2M11.05 3.95l1.2-1.2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  )
}
function IconMoon() {
  return (
    <svg width="18" height="18" viewBox="0 0 15 15" fill="none">
      <path d="M13 9.2A5.8 5.8 0 015.8 2a5.9 5.9 0 103.9 10.9c1.5-.5 2.7-1.8 3.3-3.7z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
    </svg>
  )
}
