import { useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../app/AuthContext'
import { useTheme } from '../app/ThemeContext'
import './AppShell.css'

// `feature`: exige esa función. `anyFeature`: basta con tener una. Sin nada: siempre.
const NAV = [
  { to: '/dashboard', label: 'Resumen',  Icon: IconResumen },
  { to: '/expenses',  label: 'Gastos',   Icon: IconGastos,   feature: 'gastos' },
  { to: '/invoices',  label: 'Facturas', Icon: IconFacturas, anyFeature: ['facturas', 'transporte'] },
  { to: '/clients',   label: 'Clientes', Icon: IconClientes, feature: 'clientes' },
  { to: '/export',    label: 'Exportar', Icon: IconExportar, feature: 'export' },
  { to: '/admin',     label: 'Admin',    Icon: IconAdmin,    feature: 'admin' },
  { to: '/settings',  label: 'Ajustes',  Icon: IconAjustes },
]

const BOTTOM_NAV = [
  { to: '/dashboard', label: 'Resumen',  Icon: IconResumen },
  { to: '/expenses',  label: 'Gastos',   Icon: IconGastos,   feature: 'gastos' },
  { to: '/invoices',  label: 'Facturas', Icon: IconFacturas, anyFeature: ['facturas', 'transporte'] },
  { to: '/export',    label: 'Exportar', Icon: IconExportar, feature: 'export' },
  { to: '/settings',  label: 'Ajustes',  Icon: IconAjustes },
]

function navAllowed(item, hasFeature) {
  if (item.feature) return hasFeature(item.feature)
  if (item.anyFeature) return item.anyFeature.some(hasFeature)
  return true
}

export default function AppShell() {
  const { user, logout, hasFeature } = useAuth()
  const navigate = useNavigate()
  const [mobileOpen, setMobileOpen] = useState(false)
  const bottomNav = BOTTOM_NAV.filter((item) => navAllowed(item, hasFeature))

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
        <SidebarContent initials={initials} user={user} onLogout={handleLogout} hasFeature={hasFeature} />
      </aside>

      {/* Mobile overlay sidebar */}
      {mobileOpen && (
        <div className="shell-overlay" onClick={() => setMobileOpen(false)}>
          <aside className="shell-sidebar-mobile" onClick={(e) => e.stopPropagation()}>
            <SidebarContent
              initials={initials}
              user={user}
              onLogout={handleLogout}
              hasFeature={hasFeature}
              onNavClick={() => setMobileOpen(false)}
            />
          </aside>
        </div>
      )}

      {/* Content */}
      <div className="shell-content">
        <div className="shell-mobile-bar">
          <button className="shell-burger" onClick={() => setMobileOpen(true)}>
            <IconMenu />
          </button>
          <Logo />
          <ThemeToggle className="shell-theme-mobile" />
        </div>
        <main className="shell-main">
          <Outlet />
        </main>
      </div>

      {/* Mobile bottom nav */}
      <nav className="shell-bottom-nav">
        {bottomNav.map(({ to, label, Icon }) => (
          <NavLink key={to} to={to} className={({ isActive }) =>
            'bottom-nav-item' + (isActive ? ' active' : '')
          }>
            <Icon />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  )
}

function SidebarContent({ initials, user, onLogout, onNavClick, hasFeature }) {
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
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
      <rect x="1" y="1" width="5.5" height="5.5" rx="1.5" fill="currentColor" />
      <rect x="8.5" y="1" width="5.5" height="5.5" rx="1.5" fill="currentColor" />
      <rect x="1" y="8.5" width="5.5" height="5.5" rx="1.5" fill="currentColor" />
      <rect x="8.5" y="8.5" width="5.5" height="5.5" rx="1.5" fill="currentColor" />
    </svg>
  )
}
function IconGastos() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
      <path d="M7.5 1v13M2 5l5.5 5.5L13 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
function IconFacturas() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
      <rect x="2" y="1" width="11" height="13" rx="2" stroke="currentColor" strokeWidth="1.4" />
      <path d="M5 5h5M5 7.5h5M5 10h3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  )
}
function IconExportar() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
      <path d="M7.5 1v9M4 7l3.5 3.5L11 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M2 11v2a1 1 0 001 1h9a1 1 0 001-1v-2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  )
}
function IconClientes() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
      <circle cx="5.5" cy="4.5" r="2.5" stroke="currentColor" strokeWidth="1.4" />
      <path d="M1 13c0-2.5 2-4 4.5-4s4.5 1.5 4.5 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M10.5 6.5c1.5 0 2.5 1 2.5 2.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <circle cx="10.5" cy="3.5" r="1.5" stroke="currentColor" strokeWidth="1.3" />
    </svg>
  )
}
function IconAdmin() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
      <circle cx="7.5" cy="4" r="2.5" stroke="currentColor" strokeWidth="1.4" />
      <path d="M2 13c0-3 2.5-4.5 5.5-4.5S13 10 13 13" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M11.5 2.5l.6 1.2 1.3.2-.95.9.22 1.3-1.17-.62-1.17.62.22-1.3-.95-.9 1.3-.2z" fill="currentColor" />
    </svg>
  )
}
function IconAjustes() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
      <circle cx="7.5" cy="7.5" r="2" stroke="currentColor" strokeWidth="1.4" />
      <path d="M7.5 1v1.5M7.5 12.5V14M1 7.5h1.5M12.5 7.5H14M3.11 3.11l1.06 1.06M10.83 10.83l1.06 1.06M3.11 11.89l1.06-1.06M10.83 4.17l1.06-1.06" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  )
}
function IconLogout() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path d="M5 1H2a1 1 0 00-1 1v10a1 1 0 001 1h3M9 10l3-3-3-3M12 7H5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
function IconSun() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
      <circle cx="7.5" cy="7.5" r="3" stroke="currentColor" strokeWidth="1.4" />
      <path d="M7.5 .8v1.7M7.5 12.5v1.7M.8 7.5h1.7M12.5 7.5h1.7M2.75 2.75l1.2 1.2M11.05 11.05l1.2 1.2M2.75 12.25l1.2-1.2M11.05 3.95l1.2-1.2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  )
}
function IconMoon() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
      <path d="M13 9.2A5.8 5.8 0 015.8 2a5.9 5.9 0 103.9 10.9c1.5-.5 2.7-1.8 3.3-3.7z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
    </svg>
  )
}
function IconMenu() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <path d="M3 5h14M3 10h14M3 15h14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  )
}
