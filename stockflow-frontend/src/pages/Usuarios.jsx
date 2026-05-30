import { useState, useEffect } from 'react'
import Layout from '../components/Layout.jsx'
import { useToast } from '../context/ToastContext.jsx'
import api from '../api/axios.js'
import { Plus, Search, Edit, Trash2, Shield, UserCheck, UserX, X, CheckCircle, Users, Save } from 'lucide-react'

const PERFIL_CFG = {
  administrador: 'badge-admin',
  operador: 'badge-info',
}

const DEFAULT_PERMISSIONS = {
  produtos: { ver: true, criar: true, editar: true, inativar: false },
  lotes: { ver: true, criar: true, bloquear: false },
  movimentacoes: { entrada: true, saida: true, transferencia: true, ajuste: false },
  auditoria: { ver: false },
  usuarios: { ver: false, criar: false },
  relatorios: { ver: true, exportar: false },
  sap: { importar: false },
}

const PERMISSION_ROWS = [
  { label: 'Produtos', path: ['produtos'], cells: [['ver', 'Ver'], ['criar', 'Criar'], ['editar', 'Editar'], ['inativar', 'Inativar']] },
  { label: 'Lotes', path: ['lotes'], cells: [['ver', 'Ver'], ['criar', 'Criar'], ['bloquear', 'Editar'], null] },
  { label: 'Entrada', path: ['movimentacoes'], cells: [['entrada', 'Ver'], ['entrada', 'Criar'], null, null] },
  { label: 'Saída', path: ['movimentacoes'], cells: [['saida', 'Ver'], ['saida', 'Criar'], null, null] },
  { label: 'Transferência', path: ['movimentacoes'], cells: [['transferencia', 'Ver'], ['transferencia', 'Criar'], null, null] },
  { label: 'Ajuste de Estoque', path: ['movimentacoes'], cells: [['ajuste', 'Ver'], ['ajuste', 'Criar'], null, null] },
  { label: 'Relatórios', path: ['relatorios'], cells: [['ver', 'Ver'], null, null, ['exportar', 'Exportar']] },
  { label: 'Exportar dados', path: ['relatorios'], cells: [['exportar', 'Ver'], null, null, null] },
  { label: 'Integração SAP', path: ['sap'], cells: [['importar', 'Ver'], ['importar', 'Criar'], null, null] },
  { label: 'Auditoria', path: ['auditoria'], cells: [['ver', 'Ver'], null, null, null] },
  { label: 'Usuários', path: ['usuarios'], cells: [['ver', 'Ver'], ['criar', 'Criar'], null, null] },
]

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

function Toggle({ checked, disabled, onChange }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onChange(!checked)}
      style={{
        width: 34,
        height: 20,
        borderRadius: 999,
        border: 'none',
        background: checked ? 'var(--color-brand-600)' : 'var(--color-bg-muted)',
        position: 'relative',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.55 : 1,
        transition: 'background 150ms ease',
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
        <td key={i}><div style={{ height: 14, background: 'var(--color-bg-muted)', borderRadius: 4, animation: 'shimmer 1.2s ease-in-out infinite' }} /></td>
      ))}
    </tr>
  )
}

export default function Usuarios() {
  const toast = useToast()
  const [usuarios, setUsuarios] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState(null)
  const [permissions, setPermissions] = useState(structuredClone(DEFAULT_PERMISSIONS))
  const [form, setForm] = useState({ nome: '', email: '', perfil: 'operador', senha: 'Admin@1234' })
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => { load() }, [])

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

  const filtered = usuarios.filter(u =>
    (u.nome || '').toLowerCase().includes(search.toLowerCase()) ||
    (u.email || '').toLowerCase().includes(search.toLowerCase())
  )
  const ativos = usuarios.filter(u => u.ativo !== false && u.status !== 'inativo').length

  async function handleCreate(e) {
    e.preventDefault()
    setSubmitting(true)
    try {
      await api.post('/usuarios', form)
      toast.success('Usuário criado com sucesso!')
      setShowForm(false)
      setForm({ nome: '', email: '', perfil: 'operador', senha: 'Admin@1234' })
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
    setPermissions(prev => ({
      ...prev,
      [module]: {
        ...(prev[module] || {}),
        [action]: value,
      },
    }))
  }

  async function savePermissions() {
    if (!editing) return
    try {
      await api.put(`/usuarios/${editing.id}`, {
        nome: editing.nome,
        email: editing.email,
        perfil: editing.perfil,
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

  return (
    <Layout breadcrumb={['Administração', 'Usuários']}>
      <div className="page-header">
        <div className="page-header-left">
          <h1>Usuários</h1>
          <div className="subtitle">
            <span><strong style={{ fontWeight: 600 }}>{usuarios.length}</strong> usuários cadastrados</span>
            <span className="sep" />
            <span><strong style={{ color: 'var(--color-success-700)', fontWeight: 600 }}>{ativos}</strong> ativos</span>
            <span className="sep" />
            <span style={{ background: 'var(--color-admin-100)', color: 'var(--color-admin-700)', padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 700 }}>Somente Admin</span>
          </div>
        </div>
        <div className="page-header-actions">
          <button className="btn btn-primary" onClick={() => setShowForm(true)}><Plus size={14} /> Novo usuário</button>
        </div>
      </div>

      <div className="table-wrap">
        <div className="table-toolbar">
          <div className="table-search">
            <Search size={14} />
            <input type="text" placeholder="Buscar por nome ou email..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </div>
        <table>
          <thead><tr><th>Usuário</th><th>Email</th><th>Perfil</th><th style={{ textAlign: 'center' }}>Status</th><th>Último acesso</th><th style={{ textAlign: 'right' }}>Ações</th></tr></thead>
          <tbody>
            {loading ? Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />) : filtered.length === 0 ? (
              <tr><td colSpan={6}><div className="empty-state"><div className="empty-icon"><Users size={24} /></div><div className="empty-title">Nenhum usuário encontrado</div></div></td></tr>
            ) : filtered.map(u => {
              const perfilKey = (u.perfil || '').toLowerCase()
              const ativo = u.ativo !== false && u.status !== 'inativo'
              return (
                <tr key={u.id}>
                  <td><div style={{ display: 'flex', alignItems: 'center', gap: 10 }}><div style={{ width: 32, height: 32, borderRadius: '50%', background: 'linear-gradient(135deg, var(--color-brand-600), var(--color-brand-800))', color: 'var(--color-text-inverse)', display: 'grid', placeItems: 'center', fontSize: 11, fontWeight: 700 }}>{initials(u.nome)}</div><span style={{ fontWeight: 600, fontSize: 13 }}>{u.nome}</span></div></td>
                  <td style={{ fontFamily: '"IBM Plex Mono",monospace', fontSize: 12 }}>{u.email}</td>
                  <td><span className={`badge ${PERFIL_CFG[perfilKey] || 'badge-neutral'}`}><Shield size={10} /> {u.perfil}</span></td>
                  <td style={{ textAlign: 'center' }}><span className={`badge ${ativo ? 'badge-success' : 'badge-neutral'}`}>{ativo ? <UserCheck size={10} /> : <UserX size={10} />} {ativo ? 'Ativo' : 'Inativo'}</span></td>
                  <td style={{ fontFamily: '"IBM Plex Mono",monospace', fontSize: 11, color: 'var(--color-text-tertiary)' }}>{u.ultimo_acesso ? new Date(u.ultimo_acesso).toLocaleString('pt-BR') : '—'}</td>
                  <td style={{ textAlign: 'right' }}>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 4 }}>
                      <button className="icon-btn" aria-label="Editar" onClick={() => openEdit(u)}><Edit size={14} /></button>
                      {ativo && <button className="icon-btn" aria-label="Inativar" style={{ color: 'var(--color-danger-400)' }} onClick={() => handleInativar(u.id)}><Trash2 size={14} /></button>}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        <div className="pagination"><span className="pagination-info">{filtered.length} usuários</span></div>
      </div>

      {showForm && (
        <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && setShowForm(false)}>
          <div className="modal">
            <div className="modal-header"><h3 className="modal-title">Novo Usuário</h3><button className="icon-btn" onClick={() => setShowForm(false)}><X size={16} /></button></div>
            <form onSubmit={handleCreate}>
              <div className="modal-body">
                <div className="form-row">
                  <div className="form-group"><label className="form-label">Nome completo *</label><input className="input" value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} required /></div>
                  <div className="form-group"><label className="form-label">Email corporativo *</label><input className="input" type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} required /></div>
                </div>
                <div className="form-row">
                  <div className="form-group"><label className="form-label">Perfil *</label><select className="select" value={form.perfil} onChange={e => setForm(f => ({ ...f, perfil: e.target.value }))}><option value="administrador">Administrador</option><option value="operador">Operador</option></select></div>
                  <div className="form-group"><label className="form-label">Senha inicial *</label><input className="input" type="password" value={form.senha} onChange={e => setForm(f => ({ ...f, senha: e.target.value }))} required /></div>
                </div>
              </div>
              <div className="modal-footer"><button type="button" className="btn btn-outline" onClick={() => setShowForm(false)}>Cancelar</button><button type="submit" className="btn btn-primary" disabled={submitting}>{submitting ? 'Criando...' : <><CheckCircle size={14} /> Criar usuário</>}</button></div>
            </form>
          </div>
        </div>
      )}

      {editing && (
        <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && setEditing(null)}>
          <div className="modal" style={{ maxWidth: 860 }}>
            <div className="modal-header"><h3 className="modal-title">Editar Permissões — {editing.nome}</h3><button className="icon-btn" onClick={() => setEditing(null)}><X size={16} /></button></div>
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
                        const module = row.path[0]
                        const disabled = editing.perfil === 'administrador'
                        const checked = disabled || permissions?.[module]?.[action] === true
                        return <td key={i}><Toggle checked={checked} disabled={disabled} onChange={value => setPermission(module, action, value)} /></td>
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="modal-footer"><button className="btn btn-outline" onClick={() => setEditing(null)}>Cancelar</button><button className="btn btn-primary" onClick={savePermissions}><Save size={14} /> Salvar Permissões</button></div>
          </div>
        </div>
      )}
      <style>{`@keyframes shimmer{0%,100%{opacity:1}50%{opacity:0.5}}`}</style>
    </Layout>
  )
}
