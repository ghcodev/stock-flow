import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts.js'
import { PainelAtalhos } from './PainelAtalhos.jsx'
import {
  LayoutDashboard, Package, Layers, Map, ArrowDownLeft, ArrowUpRight,
  Shuffle, Clipboard, History, ScanLine, Clock, Activity, Users, Shield,
  User, LogOut, Menu, Search, Bell, HelpCircle, Sun, Moon, Box, Sliders,
  Link2,
} from 'lucide-react'
import { useCallback, useRef, useState, useEffect } from 'react'

const NAV = [
  {
    section: 'Operação',
    items: [
      { label: 'Dashboard',      to: '/dashboard',      icon: LayoutDashboard },
      { label: 'Produtos',       to: '/produtos',        icon: Package },
      { label: 'Lotes',          to: '/lotes',           icon: Layers,  badge: '4',  badgeKind: 'warn' },
      { label: 'Mapa do Armazém',to: '/mapa',            icon: Map },
    ],
  },
  {
    section: 'Movimentações',
    items: [
      { label: 'Entrada',        to: '/entrada',         icon: ArrowDownLeft },
      { label: 'Saída',          to: '/saida',           icon: ArrowUpRight },
      { label: 'Transferência',  to: '/transferencia',   icon: Shuffle },
      { label: 'Inventário',     to: '/inventario',      icon: Clipboard },
    ],
  },
  {
    section: 'Análise',
    items: [
      { label: 'Histórico',      to: '/historico',       icon: History },
      { label: 'Rastreabilidade',to: '/rastreabilidade', icon: ScanLine },
      { label: 'Vencimentos',    to: '/alertas',         icon: Clock,   badge: '4'  },
      { label: 'Relatórios',     to: '/relatorios',      icon: Activity },
    ],
  },
  {
    section: 'Administração',
    items: [
      { label: 'Usuários',       to: '/usuarios',        icon: Users },
      { label: 'Auditoria',      to: '/auditoria',       icon: Shield,  badge: 'A', badgeKind: 'admin' },
      { label: 'Ajuste Estoque', to: '/ajuste',          icon: Sliders },
      { label: 'Integração SAP', to: '/sap',             icon: Link2, adminOnly: true },
      { label: 'Meu Perfil',     to: '/perfil',          icon: User },
    ],
  },
]

export default function Layout({ children, breadcrumb }) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [dark, setDark] = useState(() => document.documentElement.dataset.theme === 'dark')
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [ajudaAberta, setAjudaAberta] = useState(false)
  const buscaRef = useRef(null)

  useEffect(() => {
    document.documentElement.dataset.theme = dark ? 'dark' : ''
  }, [dark])

  const abrirBuscaGlobal = useCallback(() => {
    buscaRef.current?.focus()
    buscaRef.current?.select()
  }, [])

  const alternarTema = useCallback(() => {
    setDark(d => !d)
  }, [])

  const alternarAjuda = useCallback(() => {
    setAjudaAberta(v => !v)
  }, [])

  useKeyboardShortcuts({
    onAbrirBusca: abrirBuscaGlobal,
    onAbrirAjuda: alternarAjuda,
    onToggleTema: alternarTema,
  })

  function handleLogout() {
    logout()
    navigate('/login')
  }

  const SIDEBAR_W = sidebarOpen ? 224 : 60

  return (
    <>
      <div
        className="app-shell"
        style={{ gridTemplateColumns: `${SIDEBAR_W}px 1fr` }}
      >
        {/* ── SIDEBAR ── */}
        <aside
          className="sidebar"
          role="navigation"
          aria-label="Navegação principal"
          style={{ width: SIDEBAR_W }}
        >
          <div className="sidebar-header" style={{ justifyContent: sidebarOpen ? undefined : 'center', padding: sidebarOpen ? undefined : '0 8px' }}>
            <div className="sidebar-logo-mark" style={{ flexShrink: 0 }}>
              <Box size={14} color="#fff" />
            </div>
            {sidebarOpen && <div className="sidebar-logo-text">StockFlow</div>}
            {sidebarOpen && <div className="sidebar-env-badge">PROD</div>}
          </div>

          <nav className="sidebar-nav">
            {NAV.map(group => (
              <div key={group.section}>
                {sidebarOpen && (
                  <div className="sidebar-section-label">{group.section}</div>
                )}
                {group.items.filter(item => !item.adminOnly || user?.isAdmin).map(item => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    title={!sidebarOpen ? item.label : undefined}
                    className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
                    style={!sidebarOpen ? { justifyContent: 'center', padding: '0 8px' } : undefined}
                  >
                    <item.icon size={16} />
                    {sidebarOpen && <span>{item.label}</span>}
                    {sidebarOpen && item.badge && (
                      <span className={`nav-badge${item.badgeKind ? ` ${item.badgeKind}` : ''}`}>
                        {item.badge}
                      </span>
                    )}
                  </NavLink>
                ))}
              </div>
            ))}
          </nav>

          <div className="sidebar-footer" style={{ justifyContent: sidebarOpen ? undefined : 'center', padding: sidebarOpen ? undefined : '10px 0' }}>
            <div className="sidebar-avatar" title={user?.name}>{user?.initials || 'U'}</div>
            {sidebarOpen && (
              <div className="sidebar-user-info">
                <div className="sidebar-user-name">{user?.name}</div>
                <div className="sidebar-user-role">{user?.role}</div>
              </div>
            )}
            {sidebarOpen && (
              <button className="sidebar-logout" aria-label="Sair" onClick={handleLogout}>
                <LogOut size={14} />
              </button>
            )}
          </div>
        </aside>

        {/* ── MAIN ── */}
        <main className="main">
          <header className="topbar">
            <button
              className="topbar-toggle"
              aria-label={sidebarOpen ? 'Colapsar menu' : 'Expandir menu'}
              onClick={() => setSidebarOpen(o => !o)}
            >
              <Menu size={16} />
            </button>

            <nav className="breadcrumb">
              <span className="breadcrumb-root">StockFlow</span>
              {breadcrumb?.map((seg, i) => (
                <span key={i} style={{ display: 'contents' }}>
                  <span className="breadcrumb-sep">/</span>
                  {i === breadcrumb.length - 1
                    ? <span className="breadcrumb-current">{seg}</span>
                    : <span className="breadcrumb-root">{seg}</span>
                  }
                </span>
              ))}
            </nav>

            <div className="topbar-search">
              <Search size={14} />
              <input
                ref={buscaRef}
                id="busca-global"
                type="text"
                placeholder="Buscar lote, produto, RFID... (Ctrl+K)"
                aria-label="Buscar"
              />
              <span className="topbar-search-kbd">Ctrl K</span>
            </div>

            <div className="topbar-spacer" />

            <div className="topbar-right">
              <button className="alerts-pill" aria-label="14 alertas">
                <span className="dot" />
                <Bell size={14} />
                <span>4 alertas</span>
              </button>

              <button
                className="icon-btn"
                aria-label="Ajuda"
                onClick={() => setAjudaAberta(true)}
              >
                <HelpCircle size={16} />
              </button>

              <button className="icon-btn" onClick={() => setDark(d => !d)} aria-label="Tema">
                {dark ? <Sun size={16} /> : <Moon size={16} />}
              </button>

              <div className="topbar-divider" />
              <div className="topbar-avatar" title={user?.name}>{user?.initials}</div>
            </div>
          </header>

          <div className="page">
            <div className="page-inner">
              {children}
            </div>
          </div>
        </main>
      </div>

      <PainelAtalhos aberto={ajudaAberta} onFechar={() => setAjudaAberta(false)} />
      <div style={{
        position: 'fixed',
        bottom: 8,
        left: '50%',
        transform: 'translateX(-50%)',
        fontSize: 11,
        color: 'var(--color-text-secondary)',
        pointerEvents: 'none',
        userSelect: 'none',
        opacity: 0.6,
        zIndex: 20,
      }}>
        Pressione <kbd style={{ fontFamily: 'var(--font-mono, var(--font-data))', fontSize: 10, background: 'var(--color-background-secondary, var(--color-bg-subtle))', border: '0.5px solid var(--color-border-tertiary, var(--color-border-default))', borderRadius: 3, padding: '1px 5px' }}>Ctrl+/</kbd> para ver atalhos
      </div>
    </>
  )
}
