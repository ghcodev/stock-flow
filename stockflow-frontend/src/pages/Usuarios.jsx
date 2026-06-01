import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import Layout from '../components/Layout.jsx'
import { useToast } from '../context/ToastContext.jsx'
import api from '../api/axios.js'
import {
  Plus, Search, Edit, Shield, UserCheck, UserX, X,
  CheckCircle, Users, Save, MoreVertical,
} from 'lucide-react'

/* ─── Config (unchanged) ───────────────────────────────────── */
const PERFIL_CFG = {
  administrador: 'badge-admin',
  operador:      'badge-info',
}

const DEFAULT_PERMISSIONS = {
  produtos:      { ver: true,  criar: true,  editar: true, inativar: false },
  lotes:         { ver: true,  criar: true,  bloquear: false },
  movimentacoes: { entrada: true, saida: true, transferencia: true, ajuste: false },
  auditoria:     { ver: false },
  usuarios:      { ver: false, criar: false },
  relatorios:    { ver: true,  exportar: false },
  sap:           { importar: false },
}

const PERMISSION_ROWS = [
  { label: 'Produtos',          path: ['produtos'],      cells: [['ver','Ver'],['criar','Criar'],['editar','Editar'],['inativar','Inativar']] },
  { label: 'Lotes',             path: ['lotes'],         cells: [['ver','Ver'],['criar','Criar'],['bloquear','Editar'],null] },
  { label: 'Entrada',           path: ['movimentacoes'], cells: [['entrada','Ver'],['entrada','Criar'],null,null] },
  { label: 'Saída',             path: ['movimentacoes'], cells: [['saida','Ver'],['saida','Criar'],null,null] },
  { label: 'Transferência',     path: ['movimentacoes'], cells: [['transferencia','Ver'],['transferencia','Criar'],null,null] },
  { label: 'Ajuste de Estoque', path: ['movimentacoes'], cells: [['ajuste','Ver'],['ajuste','Criar'],null,null] },
  { label: 'Relatórios',        path: ['relatorios'],    cells: [['ver','Ver'],null,null,['exportar','Exportar']] },
  { label: 'Exportar dados',    path: ['relatorios'],    cells: [['exportar','Ver'],null,null,null] },
  { label: 'Integração SAP',    path: ['sap'],           cells: [['importar','Ver'],['importar','Criar'],null,null] },
  { label: 'Auditoria',         path: ['auditoria'],     cells: [['ver','Ver'],null,null,null] },
  { label: 'Usuários',          path: ['usuarios'],      cells: [['ver','Ver'],['criar','Criar'],null,null] },
]

/* ─── Pure helpers ─────────────────────────────────────────── */
function parsePerms(permissoes) {
  if (!permissoes) return structuredClone(DEFAULT_PERMISSIONS)
  if (typeof permissoes === 'object') return { ...structuredClone(DEFAULT_PERMISSIONS), ...permissoes }
  try { return { ...structuredClone(DEFAULT_PERMISSIONS), ...JSON.parse(permissoes) } } catch { return structuredClone(DEFAULT_PERMISSIONS) }
}

function initials(nome) {
  const parts = (nome || '').trim().split(' ')
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  return (parts[0] || '?').slice(0, 2).toUpperCase()
}

function fmtLastAccess(value) {
  if (!value) return '—'
  const d = new Date(value)
  if (isNaN(d.getTime())) return '—'
  const now = new Date()
  const todayStr = now.toDateString()
  const yesterday = new Date(now)
  yesterday.setDate(yesterday.getDate() - 1)
  if (d.toDateString() === todayStr) return `Hoje, ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`
  if (d.toDateString() === yesterday.toDateString()) return `Ontem, ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`
  return d.toLocaleDateString('pt-BR')
}

function isAtivo(u) {
  return u.ativo !== false && u.status !== 'inativo'
}

/* ─── Sub-components (unchanged) ──────────────────────────── */
function Toggle({ checked, disabled, onChange }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onChange(!checked)}
      style={{
        width: 34, height: 20, borderRadius: 999, border: 'none',
        background: checked ? 'var(--color-brand-600)' : 'var(--color-bg-muted)',
        position: 'relative', cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.55 : 1, transition: 'background 150ms ease',
      }}
    >
      <span style={{ position: 'absolute', top: 3, left: checked ? 17 : 3, width: 14, height: 14, borderRadius: '50%', background: 'var(--color-bg-default)', transition: 'left 150ms ease', boxShadow: 'var(--shadow-xs)' }} />
    </button>
  )
}

function SkeletonRow() {
  return (
    <tr>
      {Array.from({ length: 6 }).map((_, i) => (
        <td key={i}><div className="skeleton" style={{ height: 14 }} /></td>
      ))}
    </tr>
  )
}

function UsrKpiCard({ icon: Icon, label, value, tone }) {
  const color = {
    brand:   'var(--color-brand-600)',
    danger:  'var(--color-danger-600)',
    success: 'var(--color-success-600)',
    warning: 'var(--color-warning-600)',
    info:    'var(--color-info-600)',
    admin:   'var(--color-admin-600)',
  }[tone] || 'var(--color-text-secondary)'
  return (
    <div className="usr-kpi-card">
      <div className="usr-kpi-icon" style={{ color }}><Icon size={16} /></div>
      <div>
        <div className="usr-kpi-label">{label}</div>
        <div className="usr-kpi-value">{value}</div>
      </div>
    </div>
  )
}

function UserAvatar({ nome, size = 32 }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', flexShrink: 0,
      background: 'linear-gradient(135deg, var(--color-brand-600), var(--color-brand-800))',
      color: 'var(--color-text-inverse)', display: 'grid', placeItems: 'center',
      fontSize: size < 36 ? 11 : 14, fontWeight: 700,
    }}>
      {initials(nome)}
    </div>
  )
}

/* ─── Main component ───────────────────────────────────────── */
export default function Usuarios() {
  const toast    = useToast()
  const navigate = useNavigate()

  const [usuarios,     setUsuarios]     = useState([])
  const [loading,      setLoading]      = useState(true)
  const [search,       setSearch]       = useState('')
  const [showForm,     setShowForm]     = useState(false)
  const [editing,      setEditing]      = useState(null)
  const [permissions,  setPermissions]  = useState(structuredClone(DEFAULT_PERMISSIONS))
  const [form,         setForm]         = useState({ nome: '', email: '', perfil: 'operador', senha: '' })
  const [submitting,   setSubmitting]   = useState(false)
  const [quickFilter,  setQuickFilter]  = useState('todos')
  const [openMenuId,   setOpenMenuId]   = useState(null)
  const [selectedUser, setSelectedUser] = useState(null)
  const [newUserId,    setNewUserId]    = useState(null)

  /* ── Effects ─────────────────────────────────────────────── */
  useEffect(() => { load() }, [])

  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') { setSelectedUser(null); setOpenMenuId(null) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    if (openMenuId === null) return
    function close() { setOpenMenuId(null) }
    const t = setTimeout(() => document.addEventListener('click', close), 0)
    return () => { clearTimeout(t); document.removeEventListener('click', close) }
  }, [openMenuId])

  /* ── API (unchanged) ─────────────────────────────────────── */
  async function load() {
    setLoading(true)
    try {
      const { data } = await api.get('/usuarios')
      setUsuarios(data.data || data || [])
    } catch {
      toast.error('Erro ao carregar usuários.')
    } finally {
      setLoading(false)
    }
  }

  async function handleCreate(e) {
    e.preventDefault()
    setSubmitting(true)
    try {
      const { data } = await api.post('/usuarios', form)
      const createdId = data?.data?.id || data?.id
      if (createdId) {
        setNewUserId(createdId)
        setTimeout(() => setNewUserId(null), 2000)
      }
      toast.success('Usuário criado com sucesso!')
      setShowForm(false)
      setForm({ nome: '', email: '', perfil: 'operador', senha: '' })
      load()
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erro ao criar usuário.')
    } finally {
      setSubmitting(false)
    }
  }

  function openEdit(user) {
    setEditing(user)
    setPermissions(parsePerms(user.permissoes))
  }

  function setPermission(module, action, value) {
    setPermissions(prev => ({ ...prev, [module]: { ...(prev[module] || {}), [action]: value } }))
  }

  async function savePermissions() {
    if (!editing) return
    try {
      await api.put(`/usuarios/${editing.id}`, {
        nome:       editing.nome,
        email:      editing.email,
        perfil:     editing.perfil,
        permissoes: editing.perfil === 'administrador' ? null : permissions,
      })
      toast.success('Permissões salvas.')
      setEditing(null)
      load()
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erro ao salvar permissões.')
    }
  }

  async function handleInativar(id) {
    try {
      await api.patch(`/usuarios/${id}/inativar`)
      toast.success('Usuário inativado.')
      load()
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erro ao inativar usuário.')
    }
  }

  async function handleAlterarPerfil(u) {
    const novoPerfil = (u.perfil || '').toLowerCase() === 'administrador' ? 'operador' : 'administrador'
    if (!window.confirm(`Alterar perfil de "${u.nome}" para ${novoPerfil}?`)) return
    setOpenMenuId(null)
    try {
      await api.put(`/usuarios/${u.id}`, { nome: u.nome, email: u.email, perfil: novoPerfil })
      toast.success(`Perfil alterado para ${novoPerfil}.`)
      load()
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erro ao alterar perfil.')
    }
  }

  /* ── Computed ────────────────────────────────────────────── */
  const kpis = useMemo(() => ({
    total:      usuarios.length,
    admins:     usuarios.filter(u => (u.perfil || '').toLowerCase() === 'administrador').length,
    operadores: usuarios.filter(u => (u.perfil || '').toLowerCase() === 'operador').length,
    inativos:   usuarios.filter(u => !isAtivo(u)).length,
    ativos:     usuarios.filter(u => isAtivo(u)).length,
  }), [usuarios])

  const { quickFiltered, filterCounts } = useMemo(() => {
    const ws = usuarios.filter(u =>
      (u.nome  || '').toLowerCase().includes(search.toLowerCase()) ||
      (u.email || '').toLowerCase().includes(search.toLowerCase())
    )
    const counts = {
      todos:           ws.length,
      administradores: ws.filter(u => (u.perfil || '').toLowerCase() === 'administrador').length,
      operadores:      ws.filter(u => (u.perfil || '').toLowerCase() === 'operador').length,
      ativos:          ws.filter(u => isAtivo(u)).length,
      inativos:        ws.filter(u => !isAtivo(u)).length,
    }
    const qf = ws.filter(u => {
      if (quickFilter === 'todos')           return true
      if (quickFilter === 'administradores') return (u.perfil || '').toLowerCase() === 'administrador'
      if (quickFilter === 'operadores')      return (u.perfil || '').toLowerCase() === 'operador'
      if (quickFilter === 'ativos')          return isAtivo(u)
      if (quickFilter === 'inativos')        return !isAtivo(u)
      return true
    })
    return { quickFiltered: qf, filterCounts: counts }
  }, [usuarios, search, quickFilter])

  /* ── Render ──────────────────────────────────────────────── */
  return (
    <Layout breadcrumb={['Administração', 'Usuários']}>
      <div className="page-header">
        <div className="page-header-left">
          <h1>Usuários</h1>
          <div className="subtitle">
            <span><strong style={{ fontWeight: 600 }}>{usuarios.length}</strong> usuários cadastrados</span>
            <span className="sep" />
            <span><strong style={{ color: 'var(--color-success-700)', fontWeight: 600 }}>{kpis.ativos}</strong> ativos</span>
            <span className="sep" />
            <span style={{ background: 'var(--color-admin-100)', color: 'var(--color-admin-700)', padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 700 }}>Somente Admin</span>
          </div>
        </div>
        <div className="page-header-actions">
          <button type="button" className="btn btn-primary" onClick={() => setShowForm(true)}>
            <Plus size={14} /> Novo usuário
          </button>
        </div>
      </div>

      {/* KPI Strip */}
      <div className="usr-kpi-grid">
        <UsrKpiCard icon={Users}     label="Total de Usuários" value={kpis.total}      tone="brand"  />
        <UsrKpiCard icon={Shield}    label="Administradores"   value={kpis.admins}     tone="admin"  />
        <UsrKpiCard icon={UserCheck} label="Operadores"        value={kpis.operadores} tone="info"   />
        <UsrKpiCard icon={UserX}     label="Inativos"          value={kpis.inativos}   tone="danger" />
      </div>

      <div className="table-wrap">
        {/* Toolbar */}
        <div className="table-toolbar">
          <div className="table-search">
            <Search size={14} />
            <input
              type="text"
              placeholder="Buscar por nome ou email..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <span className="usr-result-count">{quickFiltered.length} resultados</span>
        </div>

        {/* Filter strip */}
        <div className="usr-filter-strip">
          {[
            ['todos',           'Todos'],
            ['administradores', 'Administradores'],
            ['operadores',      'Operadores'],
            ['ativos',          'Ativos'],
            ['inativos',        'Inativos'],
          ].map(([id, label]) => (
            <button
              key={id}
              type="button"
              className={`usr-filter-chip${quickFilter === id ? ' active' : ''}`}
              onClick={() => setQuickFilter(id)}
            >
              {label} <span>{filterCounts[id] ?? 0}</span>
            </button>
          ))}
        </div>

        {/* Table */}
        <div className="usr-table-scroll">
          <table className="usr-table">
            <thead>
              <tr>
                <th>Usuário</th>
                <th>Email</th>
                <th>Perfil</th>
                <th style={{ textAlign: 'center' }}>Status</th>
                <th>Último acesso</th>
                <th style={{ textAlign: 'right', width: 48 }}></th>
              </tr>
            </thead>
            <tbody>
              {loading
                ? Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)
                : quickFiltered.length === 0
                  ? (
                    <tr><td colSpan={6}>
                      <div className="empty-state">
                        <div className="empty-icon empty-icon-animated"><Users size={24} /></div>
                        <div className="empty-title">Nenhum usuário encontrado</div>
                        <div className="empty-sub">{quickFilter !== 'todos' ? 'Tente outro filtro.' : 'Nenhum usuário cadastrado.'}</div>
                      </div>
                    </td></tr>
                  )
                  : quickFiltered.map(u => {
                    const perfilKey = (u.perfil || '').toLowerCase()
                    const ativo     = isAtivo(u)
                    return (
                      <tr
                        key={u.id}
                        className={`usr-row${u.id === newUserId ? ' row-new' : ''}`}
                        onClick={() => { setSelectedUser(u); setOpenMenuId(null) }}
                      >
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <UserAvatar nome={u.nome} size={32} />
                            <span style={{ fontWeight: 600, fontSize: 13 }}>{u.nome}</span>
                          </div>
                        </td>
                        <td style={{ fontFamily: '"IBM Plex Mono",monospace', fontSize: 12 }}>{u.email}</td>
                        <td>
                          <span className={`badge ${PERFIL_CFG[perfilKey] || 'badge-neutral'}`}>
                            <Shield size={10} /> {u.perfil}
                          </span>
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <span className={`badge ${ativo ? 'badge-success' : 'badge-neutral'}`}>
                            {ativo ? <UserCheck size={10} /> : <UserX size={10} />} {ativo ? 'Ativo' : 'Inativo'}
                          </span>
                        </td>
                        <td style={{ fontFamily: '"IBM Plex Mono",monospace', fontSize: 11, color: 'var(--color-text-tertiary)' }}>
                          {fmtLastAccess(u.ultimo_acesso)}
                        </td>
                        <td style={{ textAlign: 'right' }} onClick={e => e.stopPropagation()}>
                          <div className="usr-actions">
                            <button
                              type="button"
                              className="icon-btn"
                              aria-label="Ações"
                              onClick={() => setOpenMenuId(openMenuId === u.id ? null : u.id)}
                            >
                              <MoreVertical size={14} />
                            </button>
                            {openMenuId === u.id && (
                              <div className="usr-menu">
                                <button type="button" onClick={() => { setOpenMenuId(null); openEdit(u) }}>
                                  <Edit size={13} /> Editar usuário
                                </button>
                                <button type="button" onClick={() => handleAlterarPerfil(u)}>
                                  <Shield size={13} /> Alterar perfil
                                </button>
                                {ativo && (
                                  <button
                                    type="button"
                                    style={{ color: 'var(--color-danger-600)' }}
                                    onClick={() => {
                                      if (window.confirm(`Inativar o usuário "${u.nome}"?`)) {
                                        setOpenMenuId(null)
                                        handleInativar(u.id)
                                      }
                                    }}
                                  >
                                    <UserX size={13} /> Inativar usuário
                                  </button>
                                )}
                                <div className="usr-menu-sep" />
                                <button type="button" onClick={() => { setOpenMenuId(null); navigate(`/auditoria?busca=${encodeURIComponent(u.nome || '')}`) }}>
                                  <Shield size={13} /> Ver logs de auditoria
                                </button>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })
              }
            </tbody>
          </table>
        </div>

        <div className="pagination">
          <span className="pagination-info">{quickFiltered.length} usuários</span>
        </div>
      </div>

      {/* Drawer */}
      {selectedUser && (
        <div
          className="usr-drawer-layer"
          onMouseDown={e => { if (e.target === e.currentTarget) setSelectedUser(null) }}
        >
          <aside className="usr-drawer" role="dialog" aria-label="Detalhes do usuário">
            <div className="usr-drawer-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <UserAvatar nome={selectedUser.nome} size={44} />
                <div>
                  <div className="usr-drawer-eyebrow">Usuário</div>
                  <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--color-text-primary)', lineHeight: 1.2 }}>{selectedUser.nome}</div>
                  <div style={{ marginTop: 4 }}>
                    <span className={`badge ${PERFIL_CFG[(selectedUser.perfil || '').toLowerCase()] || 'badge-neutral'}`}>
                      <Shield size={10} /> {selectedUser.perfil}
                    </span>
                  </div>
                </div>
              </div>
              <button className="icon-btn" onClick={() => setSelectedUser(null)} aria-label="Fechar">
                <X size={15} />
              </button>
            </div>

            <div className="usr-drawer-body">
              {/* Dados pessoais */}
              <div className="usr-drawer-section">Dados pessoais</div>
              {[
                ['Nome',    selectedUser.nome  || '—'],
                ['Email',   selectedUser.email || '—'],
              ].map(([label, value]) => (
                <div key={label} className="usr-drawer-row">
                  <span>{label}</span><strong>{value}</strong>
                </div>
              ))}
              <div className="usr-drawer-row">
                <span>Perfil</span>
                <span className={`badge ${PERFIL_CFG[(selectedUser.perfil || '').toLowerCase()] || 'badge-neutral'}`}>
                  <Shield size={10} /> {selectedUser.perfil}
                </span>
              </div>
              <div className="usr-drawer-row">
                <span>Status</span>
                {(() => {
                  const ativo = isAtivo(selectedUser)
                  return (
                    <span className={`badge ${ativo ? 'badge-success' : 'badge-neutral'}`}>
                      {ativo ? <UserCheck size={10} /> : <UserX size={10} />} {ativo ? 'Ativo' : 'Inativo'}
                    </span>
                  )
                })()}
              </div>

              {/* Acesso */}
              <div className="usr-drawer-section" style={{ marginTop: 18, paddingTop: 14, borderTop: '1px solid var(--color-border-default)' }}>Acesso</div>
              {[
                ['Último acesso',  fmtLastAccess(selectedUser.ultimo_acesso) || 'Nunca'],
                ['Membro desde',   selectedUser.criado_em ? new Date(selectedUser.criado_em).toLocaleDateString('pt-BR') : '—'],
              ].map(([label, value]) => (
                <div key={label} className="usr-drawer-row">
                  <span>{label}</span><strong>{value}</strong>
                </div>
              ))}

              {/* Ações rápidas */}
              <div className="usr-drawer-section" style={{ marginTop: 18, paddingTop: 14, borderTop: '1px solid var(--color-border-default)' }}>Ações rápidas</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  style={{ justifyContent: 'flex-start' }}
                  onClick={() => { setSelectedUser(null); openEdit(selectedUser) }}
                >
                  <Edit size={13} /> Editar usuário
                </button>
                {isAtivo(selectedUser) && (
                  <button
                    type="button"
                    className="btn btn-outline btn-sm"
                    style={{ justifyContent: 'flex-start', borderColor: 'var(--color-danger-200)', color: 'var(--color-danger-600)', background: 'var(--color-danger-50)' }}
                    onClick={() => {
                      if (window.confirm(`Inativar o usuário "${selectedUser.nome}"?`)) {
                        setSelectedUser(null)
                        handleInativar(selectedUser.id)
                      }
                    }}
                  >
                    <UserX size={13} /> Inativar
                  </button>
                )}
              </div>
            </div>
          </aside>
        </div>
      )}

      {/* Modal: Novo usuário (unchanged) */}
      {showForm && (
        <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && setShowForm(false)}>
          <div className="modal">
            <div className="modal-header">
              <h3 className="modal-title">Novo Usuário</h3>
              <button className="icon-btn" onClick={() => setShowForm(false)}><X size={16} /></button>
            </div>
            <form onSubmit={handleCreate}>
              <div className="modal-body">
                <div className="form-row">
                  <div className="form-group input-float"><input className="input" value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} placeholder=" " required /><label>Nome completo *</label></div>
                  <div className="form-group input-float"><input className="input" type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder=" " required /><label>Email corporativo *</label></div>
                </div>
                <div className="form-row">
                  <div className="form-group input-float"><select className="select" value={form.perfil} onChange={e => setForm(f => ({ ...f, perfil: e.target.value }))}><option value="administrador">Administrador</option><option value="operador">Operador</option></select><label>Perfil *</label></div>
                  <div className="form-group input-float"><input className="input" type="password" value={form.senha} onChange={e => setForm(f => ({ ...f, senha: e.target.value }))} placeholder=" " required /><label>Senha inicial *</label></div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={() => setShowForm(false)}>Cancelar</button>
                <button type="submit" className={`btn btn-primary ${submitting ? 'btn-loading' : ''}`} disabled={submitting}>
                  {submitting ? 'Criando...' : <><CheckCircle size={14} /> Criar usuário</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Editar permissões (unchanged) */}
      {editing && (
        <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && setEditing(null)}>
          <div className="modal" style={{ maxWidth: 860 }}>
            <div className="modal-header">
              <h3 className="modal-title">Editar Permissões — {editing.nome}</h3>
              <button className="icon-btn" onClick={() => setEditing(null)}><X size={16} /></button>
            </div>
            <div className="modal-body">
              <div style={{ marginBottom: 14, padding: 12, borderRadius: 8, background: 'var(--color-info-50)', color: 'var(--color-info-700)', fontSize: 12 }}>
                Administradores têm acesso total e não podem ter permissões restritas.
              </div>
              <table>
                <thead><tr><th>Módulo</th><th>Ver</th><th>Criar</th><th>Editar</th><th>Excluir/Inativar</th></tr></thead>
                <tbody>
                  {PERMISSION_ROWS.map(row => (
                    <tr key={row.label}>
                      <td style={{ fontWeight: 700 }}>{row.label}</td>
                      {row.cells.map((cell, i) => {
                        if (!cell) return <td key={i} style={{ color: 'var(--color-text-tertiary)', background: 'var(--color-bg-subtle)', textAlign: 'center' }}>—</td>
                        const [action] = cell
                        const module   = row.path[0]
                        const disabled = editing.perfil === 'administrador'
                        const checked  = disabled || permissions?.[module]?.[action] === true
                        return <td key={i}><Toggle checked={checked} disabled={disabled} onChange={value => setPermission(module, action, value)} /></td>
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={() => setEditing(null)}>Cancelar</button>
              <button className="btn btn-primary" onClick={savePermissions}><Save size={14} /> Salvar Permissões</button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes usr-drawer-in { from{opacity:0;transform:translateX(16px)} to{opacity:1;transform:translateX(0)} }

        /* KPI Strip */
        .usr-kpi-grid { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:12px; margin-bottom:16px }
        .usr-kpi-card { display:flex; align-items:center; gap:12px; min-height:74px; padding:12px 14px; background:var(--color-bg-default); border:1px solid var(--color-border-default); border-radius:var(--radius-md); box-shadow:var(--shadow-xs) }
        .usr-kpi-icon { width:30px; height:30px; display:grid; place-items:center; background:var(--color-bg-subtle); border:1px solid var(--color-border-muted); border-radius:var(--radius-sm); flex-shrink:0 }
        .usr-kpi-label { font-size:10px; font-weight:700; color:var(--color-text-tertiary); text-transform:uppercase; letter-spacing:0.08em }
        .usr-kpi-value { margin-top:2px; font-size:26px; line-height:1; font-weight:800; color:var(--color-text-primary); font-variant-numeric:tabular-nums }

        /* Table */
        .usr-result-count { margin-left:auto; font-size:12px; color:var(--color-text-tertiary); white-space:nowrap }
        .usr-filter-strip { display:flex; gap:8px; padding:10px 20px; border-bottom:1px solid var(--color-border-default); background:var(--color-bg-elevated); flex-wrap:wrap }
        .usr-filter-chip { display:inline-flex; align-items:center; gap:6px; height:28px; padding:0 10px; border:1px solid var(--color-border-default); border-radius:6px; background:var(--color-bg-default); color:var(--color-text-secondary); font-size:12px; font-weight:700; cursor:pointer; transition:background 100ms,border-color 100ms,color 100ms }
        .usr-filter-chip span { color:var(--color-text-tertiary); font-variant-numeric:tabular-nums }
        .usr-filter-chip:hover,.usr-filter-chip.active { background:var(--color-bg-subtle); border-color:var(--color-border-strong); color:var(--color-text-primary) }
        .usr-table-scroll { overflow-x:auto; max-height:calc(100vh - 380px) }
        .usr-table thead th { position:sticky; top:0; z-index:2; background:var(--color-bg-elevated) }
        .usr-row { cursor:pointer; transition:background 80ms }
        .usr-row:hover { background:var(--color-bg-subtle) }

        /* Context menu */
        .usr-actions { position:relative; display:inline-flex; justify-content:flex-end }
        .usr-menu { position:absolute; right:0; top:34px; z-index:10; min-width:200px; padding:6px; background:var(--color-bg-default); border:1px solid var(--color-border-default); border-radius:var(--radius-md); box-shadow:var(--shadow-md) }
        .usr-menu button { width:100%; display:flex; align-items:center; gap:8px; min-height:30px; padding:0 8px; border-radius:5px; color:var(--color-text-secondary); font-size:12px; font-weight:600; text-align:left }
        .usr-menu button:hover { background:var(--color-bg-subtle); color:var(--color-text-primary) }
        .usr-menu-sep { height:1px; background:var(--color-border-muted); margin:4px 0 }

        /* Drawer */
        .usr-drawer-layer { position:fixed; inset:0; z-index:30; display:flex; justify-content:flex-end; background:transparent }
        .usr-drawer { width:min(460px,100%); height:100%; background:var(--color-bg-default); border-left:1px solid var(--color-border-default); box-shadow:var(--shadow-lg); animation:usr-drawer-in 160ms ease-out; display:flex; flex-direction:column }
        .usr-drawer-header { display:flex; justify-content:space-between; align-items:flex-start; gap:16px; padding:20px; border-bottom:1px solid var(--color-border-default); background:var(--color-bg-elevated) }
        .usr-drawer-eyebrow { color:var(--color-text-tertiary); font-size:10px; font-weight:800; letter-spacing:0.08em; text-transform:uppercase; margin-bottom:4px }
        .usr-drawer-body { flex:1; overflow:auto; padding:16px 20px }
        .usr-drawer-section { font-size:11px; font-weight:800; text-transform:uppercase; letter-spacing:0.07em; color:var(--color-text-tertiary); margin-bottom:8px }
        .usr-drawer-row { display:flex; justify-content:space-between; align-items:center; gap:16px; padding:10px 0; border-bottom:1px solid var(--color-border-muted); font-size:13px }
        .usr-drawer-row span:first-child { color:var(--color-text-tertiary); flex-shrink:0 }
        .usr-drawer-row strong { color:var(--color-text-primary); font-weight:700; text-align:right; word-break:break-word }

        @media(max-width:1180px) { .usr-kpi-grid{grid-template-columns:repeat(2,minmax(0,1fr))} }
        @media(max-width:700px)  { .usr-kpi-grid{grid-template-columns:1fr} .usr-table-scroll{max-height:none} }
      `}</style>
    </Layout>
  )
}

