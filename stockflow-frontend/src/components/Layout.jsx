import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { useToast } from '../context/ToastContext.jsx'
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts.js'
import { PainelAtalhos } from './PainelAtalhos.jsx'
import SobreModal from './SobreModal.jsx'
import api from '../api/axios.js'
import {
  LayoutDashboard, Package, Layers, Map, ArrowDownLeft, ArrowUpRight,
  Shuffle, Clipboard, History, ScanLine, Clock, Activity, Users, Shield,
  User, LogOut, Menu, Search, Bell, HelpCircle, Info, Sun, Moon, Box, Sliders,
  Link2,
} from 'lucide-react'
import { useCallback, useRef, useState, useEffect } from 'react'

const NAV = [
  {
    section: 'Operação',
    items: [
      { label: 'Dashboard',       to: '/dashboard',       icon: LayoutDashboard },
      { label: 'Produtos',        to: '/produtos',        icon: Package },
      { label: 'Lotes',           to: '/lotes',           icon: Layers,  badge: '4', badgeKind: 'warn' },
      { label: 'Mapa do Armazém', to: '/mapa',            icon: Map },
    ],
  },
  {
    section: 'Movimentações',
    items: [
      { label: 'Entrada',         to: '/entrada',         icon: ArrowDownLeft },
      { label: 'Saída',           to: '/saida',           icon: ArrowUpRight },
      { label: 'Transferência',   to: '/transferencia',   icon: Shuffle },
      { label: 'Inventário',      to: '/inventario',      icon: Clipboard },
      { label: 'Histórico',       to: '/historico',       icon: History },
    ],
  },
  {
    section: 'Análise',
    items: [
      { label: 'Rastreabilidade', to: '/rastreabilidade', icon: ScanLine },
      { label: 'Vencimentos',     to: '/alertas',         icon: Clock,   badge: '4' },
      { label: 'Relatórios',      to: '/relatorios',      icon: Activity },
    ],
  },
  {
    section: 'Administração',
    items: [
      { label: 'Usuários',        to: '/usuarios',        icon: Users,   adminOnly: true },
      { label: 'Auditoria',       to: '/auditoria',       icon: Shield,  adminOnly: true },
      { label: 'Ajuste Estoque',  to: '/ajuste',          icon: Sliders, adminOnly: true },
      { label: 'Integração SAP',  to: '/sap',             icon: Link2,   adminOnly: true },
    ],
  },
  {
    section: null,
    items: [
      { label: 'Meu Perfil',      to: '/perfil',          icon: User },
    ],
  },
]

export default function Layout({ children, breadcrumb }) {
  const { user, logout } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()
  const location = useLocation()
  const [dark, setDark] = useState(() => document.documentElement.dataset.theme === 'dark')
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [ajudaAberta, setAjudaAberta] = useState(false)
  const [showSobre, setShowSobre] = useState(false)
  const [globalSearch, setGlobalSearch] = useState('')
  const [alertasCount, setAlertasCount] = useState(0)
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

  const handleThemeToggle = useCallback((e) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const ripple = document.createElement('div')
    ripple.className = 'theme-ripple'
    ripple.style.left = `${rect.left + rect.width / 2 - 20}px`
    ripple.style.top = `${rect.top + rect.height / 2 - 20}px`
    document.body.appendChild(ripple)
    setTimeout(() => {
      setDark(d => !d)
      ripple.remove()
    }, 300)
  }, [])

  const alternarAjuda = useCallback(() => {
    setAjudaAberta(v => !v)
  }, [])

  const handleGlobalSearch = useCallback((e) => {
    e?.preventDefault()
    const termo = globalSearch.trim()

    if (!termo) {
      toast?.warning('Digite um lote, produto ou código para buscar.')
      return
    }

    navigate(`/rastreabilidade?busca=${encodeURIComponent(termo)}`)
  }, [globalSearch, navigate, toast])

  useEffect(() => {
    let ativo = true

    async function carregarAlertas() {
      try {
        const { data } = await api.get('/lotes/vencendo')
        const items = data.data || data || []
        if (ativo) setAlertasCount(items.length)
      } catch {
        if (ativo) setAlertasCount(0)
      }
    }

    carregarAlertas()
    return () => { ativo = false }
  }, [])

  useKeyboardShortcuts({
    onAbrirBusca: abrirBuscaGlobal,
    onAbrirAjuda: alternarAjuda,
    onToggleTema: alternarTema,
    onAbrirSobre: useCallback(() => setShowSobre(v => !v), []),
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
            {NAV.map((group, gIdx) => {
              const visibleItems = group.items.filter(item => !item.adminOnly || user?.isAdmin)
              if (visibleItems.length === 0) return null
              return (
                <div key={gIdx}>
                  {/* Separator + no label for the null section (Meu Perfil) */}
                  {!group.section && (
                    <div style={{ borderTop: '1px solid var(--color-sidebar-border)', margin: '6px 0 4px' }} />
                  )}
                  {group.section && sidebarOpen && (
                    <div className="sidebar-section-label">{group.section}</div>
                  )}
                  {visibleItems.map(item => (
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
                        item.label === 'Vencimentos' && Number(item.badge) > 0 ? (
                          <span className="badge-ping">
                            <span className={`nav-badge${item.badgeKind ? ` ${item.badgeKind}` : ''}`}>
                              {item.badge}
                            </span>
                          </span>
                        ) : (
                          <span className={`nav-badge${item.badgeKind ? ` ${item.badgeKind}` : ''}`}>
                            {item.badge}
                          </span>
                        )
                      )}
                    </NavLink>
                  ))}
                </div>
              )
            })}
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
              <button className="sidebar-logout tooltip-wrap" data-tooltip="Sair" aria-label="Sair" onClick={handleLogout}>
                <LogOut size={14} />
              </button>
            )}
          </div>
        </aside>

        {/* ── MAIN ── */}
        <main className="main">
          <header className="topbar">
            <button
              className="topbar-toggle tooltip-wrap"
              data-tooltip={sidebarOpen ? 'Recolher menu' : 'Expandir menu'}
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

            <form className="topbar-search" onSubmit={handleGlobalSearch}>
              <Search size={14} />
              <input
                ref={buscaRef}
                id="busca-global"
                type="text"
                placeholder="Buscar lote, produto, RFID... (Ctrl+K)"
                aria-label="Buscar"
                value={globalSearch}
                onChange={e => setGlobalSearch(e.target.value)}
              />
              <span className="topbar-search-kbd">Ctrl K</span>
            </form>

            <div className="topbar-spacer" />

            <div className="topbar-right">
              <button
                className="alerts-pill"
                aria-label={`${alertasCount} alertas`}
                onClick={() => navigate('/alertas-vencimento')}
              >
                <span className="dot" />
                <Bell size={14} />
                <span>{alertasCount} alertas</span>
              </button>

              <button
                className="icon-btn tooltip-wrap"
                data-tooltip="Sobre o sistema"
                aria-label="Sobre o sistema"
                onClick={() => setShowSobre(true)}
              >
                <Info size={16} />
              </button>

              <button
                className="icon-btn tooltip-wrap"
                data-tooltip="Atalhos de teclado"
                aria-label="Ajuda"
                onClick={() => setAjudaAberta(true)}
              >
                <HelpCircle size={16} />
              </button>

              <button className="icon-btn tooltip-wrap" data-tooltip="Alternar tema" onClick={handleThemeToggle} aria-label="Tema">
                {dark ? <Sun size={16} /> : <Moon size={16} />}
              </button>

              <div className="topbar-divider" />
              <div className="topbar-avatar" title={user?.name}>{user?.initials}</div>
            </div>
          </header>

          <div className="page">
            <div className="page-inner" key={location.pathname}>
              {children}
            </div>
          </div>
        </main>
      </div>

      <PainelAtalhos aberto={ajudaAberta} onFechar={() => setAjudaAberta(false)} />
      {showSobre && <SobreModal onClose={() => setShowSobre(false)} />}
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
