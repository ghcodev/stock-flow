import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import {
  LayoutDashboard, Package, Layers, Map, ArrowDownLeft, ArrowUpRight,
  Shuffle, Clipboard, History, ScanLine, Clock, Activity, Users, Shield,
  User, LogOut, Menu, Search, Bell, HelpCircle, Sun, Moon, Box, Sliders, X,
} from 'lucide-react'
import { useState, useEffect } from 'react'

const NAV = [
  {
    section: 'Operação',
    items: [
      { label: 'Dashboard',      to: '/dashboard',      icon: LayoutDashboard },
      { label: 'Produtos',       to: '/produtos',        icon: Package },
      { label: 'Lotes',          to: '/lotes',           icon: Layers,  badge: '17', badgeKind: 'warn' },
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
      { label: 'Vencimentos',    to: '/alertas',         icon: Clock,   badge: '14' },
      { label: 'Relatórios',     to: '/relatorios',      icon: Activity },
    ],
  },
  {
    section: 'Administração',
    items: [
      { label: 'Usuários',       to: '/usuarios',        icon: Users },
      { label: 'Auditoria',      to: '/auditoria',       icon: Shield,  badge: 'A', badgeKind: 'admin' },
      { label: 'Ajuste Estoque', to: '/ajuste',          icon: Sliders },
      { label: 'Meu Perfil',     to: '/perfil',          icon: User },
    ],
  },
]

export default function Layout({ children, breadcrumb }) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [dark, setDark] = useState(() => document.documentElement.dataset.theme === 'dark')
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [showHelp, setShowHelp] = useState(false)

  useEffect(() => {
    document.documentElement.dataset.theme = dark ? 'dark' : ''
  }, [dark])

  useEffect(() => {
    if (!showHelp) return
    function onKey(e) { if (e.key === 'Escape') setShowHelp(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [showHelp])

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
                {group.items.map(item => (
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
              <input type="text" placeholder="Buscar lote, produto, RFID…" aria-label="Buscar" />
              <span className="topbar-search-kbd">⌘K</span>
            </div>

            <div className="topbar-spacer" />

            <div className="topbar-right">
              <button className="alerts-pill" aria-label="14 alertas">
                <span className="dot" />
                <Bell size={14} />
                <span>14 alertas</span>
              </button>

              <button
                className="icon-btn"
                aria-label="Ajuda"
                onClick={() => setShowHelp(true)}
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

      {/* ── HELP MODAL ── */}
      {showHelp && (
        <div
          className="modal-backdrop"
          onClick={e => e.target === e.currentTarget && setShowHelp(false)}
        >
          <div className="modal" style={{ maxWidth: 440 }}>
            <div className="modal-header">
              <h3 className="modal-title">Ajuda — StockFlow</h3>
              <button className="icon-btn" onClick={() => setShowHelp(false)} aria-label="Fechar">
                <X size={16} />
              </button>
            </div>

            <div className="modal-body" style={{ padding: '20px 24px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {[
                  { emoji: '📦', label: 'Versão',        value: 'StockFlow v1.3' },
                  { emoji: '🔗', label: 'API',           value: 'localhost:3000/api/v1' },
                  { emoji: '👤', label: 'Suporte',       value: 'admin@stockflow.com' },
                  { emoji: '📄', label: 'Documentação',  value: 'Disponível com o administrador' },
                ].map(row => (
                  <div key={row.label} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', background: 'var(--color-bg-subtle)', borderRadius: 8, border: '1px solid var(--color-border-default)' }}>
                    <span style={{ fontSize: 18, lineHeight: 1 }}>{row.emoji}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-text-tertiary)', marginBottom: 2 }}>{row.label}</div>
                      <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-text-primary)', fontFamily: row.label === 'API' ? '"IBM Plex Mono",monospace' : undefined, wordBreak: 'break-all' }}>{row.value}</div>
                    </div>
                  </div>
                ))}
              </div>

              <div style={{ marginTop: 16, padding: '10px 14px', background: 'var(--color-info-50)', border: '1px solid var(--color-info-100)', borderRadius: 8, fontSize: 12, color: 'var(--color-info-700)', lineHeight: 1.5 }}>
                Pressione <kbd style={{ fontFamily: '"IBM Plex Mono",monospace', background: 'var(--color-bg-default)', border: '1px solid var(--color-border-strong)', borderRadius: 4, padding: '1px 5px', fontSize: 11 }}>Esc</kbd> para fechar este modal.
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn btn-outline" style={{ width: '100%' }} onClick={() => setShowHelp(false)}>
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
