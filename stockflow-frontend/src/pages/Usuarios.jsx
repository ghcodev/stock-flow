import { useState, useEffect } from 'react'
import Layout from '../components/Layout.jsx'
import { useToast } from '../context/ToastContext.jsx'
import api from '../api/axios.js'
import { Plus, Search, Edit, Trash2, Shield, UserCheck, UserX, X, CheckCircle, Users } from 'lucide-react'

const PERFIL_CFG = {
  'administrador': 'badge-admin',
  'operador':      'badge-info',
  'visualizador':  'badge-neutral',
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

function initials(nome) {
  const parts = (nome || '').trim().split(' ')
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  return (parts[0] || '?').slice(0, 2).toUpperCase()
}

export default function Usuarios() {
  const toast = useToast()
  const [usuarios, setUsuarios] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ nome: '', email: '', perfil: '' })
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
    if (!form.nome || !form.email || !form.perfil) return
    setSubmitting(true)
    try {
      await api.post('/usuarios', form)
      toast.success('Usuário criado com sucesso!')
      setShowForm(false)
      setForm({ nome: '', email: '', perfil: '' })
      load()
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erro ao criar usuário.')
    } finally {
      setSubmitting(false)
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
            <input type="text" placeholder="Buscar por nome ou email…" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </div>
        <table>
          <thead>
            <tr>
              <th>Usuário</th>
              <th>Email</th>
              <th>Perfil</th>
              <th style={{ textAlign: 'center' }}>Status</th>
              <th>Último acesso</th>
              <th style={{ textAlign: 'right' }}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {loading
              ? Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)
              : filtered.length === 0
                ? (
                  <tr><td colSpan={6}>
                    <div className="empty-state">
                      <div className="empty-icon"><Users size={24} /></div>
                      <div className="empty-title">Nenhum usuário encontrado</div>
                      <div className="empty-sub">{search ? 'Tente outro termo de busca.' : 'Cadastre o primeiro usuário.'}</div>
                    </div>
                  </td></tr>
                )
                : filtered.map(u => {
                  const perfilKey = (u.perfil || '').toLowerCase()
                  const ativo = u.ativo !== false && u.status !== 'inativo'
                  return (
                    <tr key={u.id}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'linear-gradient(135deg,#2E75B6,#1F3864)', color: '#fff', display: 'grid', placeItems: 'center', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>{initials(u.nome)}</div>
                          <span style={{ fontWeight: 600, fontSize: 13 }}>{u.nome}</span>
                        </div>
                      </td>
                      <td style={{ fontFamily: '"IBM Plex Mono",monospace', fontSize: 12 }}>{u.email}</td>
                      <td><span className={`badge ${PERFIL_CFG[perfilKey] || 'badge-neutral'}`}><Shield size={10} /> {u.perfil}</span></td>
                      <td style={{ textAlign: 'center' }}>
                        <span className={`badge ${ativo ? 'badge-success' : 'badge-neutral'}`}>
                          {ativo ? <UserCheck size={10} /> : <UserX size={10} />} {ativo ? 'Ativo' : 'Inativo'}
                        </span>
                      </td>
                      <td style={{ fontFamily: '"IBM Plex Mono",monospace', fontSize: 11, color: 'var(--color-text-tertiary)' }}>
                        {u.ultimo_acesso ? new Date(u.ultimo_acesso).toLocaleString('pt-BR') : '—'}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 4 }}>
                          <button className="icon-btn" aria-label="Editar"><Edit size={14} /></button>
                          {ativo && <button className="icon-btn" aria-label="Inativar" style={{ color: 'var(--color-danger-400)' }} onClick={() => handleInativar(u.id)}><Trash2 size={14} /></button>}
                        </div>
                      </td>
                    </tr>
                  )
                })
            }
          </tbody>
        </table>
        <div className="pagination">
          <span className="pagination-info">{filtered.length} usuários</span>
        </div>
      </div>

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
                  <div className="form-group">
                    <label className="form-label">Nome completo *</label>
                    <input className="input" placeholder="Nome Sobrenome" value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} required />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Email corporativo *</label>
                    <input className="input" type="email" placeholder="nome@empresa.com" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} required />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Perfil de acesso *</label>
                  <select className="select" value={form.perfil} onChange={e => setForm(f => ({ ...f, perfil: e.target.value }))} required>
                    <option value="">Selecionar perfil…</option>
                    <option value="administrador">Administrador</option>
                    <option value="operador">Operador</option>
                    <option value="visualizador">Visualizador</option>
                  </select>
                </div>
                <div style={{ background: 'var(--color-info-50)', border: '1px solid var(--color-info-100)', borderRadius: 8, padding: '12px 16px', fontSize: 12, color: 'var(--color-info-700)', marginTop: 8 }}>
                  O usuário receberá um email com link para definir sua senha.
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={() => setShowForm(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting
                    ? <><span style={{ width: 13, height: 13, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.65s linear infinite', display: 'inline-block' }} /> Criando…</>
                    : <><CheckCircle size={14} /> Criar usuário</>
                  }
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      <style>{`@keyframes shimmer{0%,100%{opacity:1}50%{opacity:0.5}} @keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </Layout>
  )
}
