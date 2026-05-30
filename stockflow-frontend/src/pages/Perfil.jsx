import { useState, useEffect } from 'react'
import Layout from '../components/Layout.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { useToast } from '../context/ToastContext.jsx'
import api from '../api/axios.js'
import { User, Shield, Key, Clock, CheckCircle, Eye, EyeOff } from 'lucide-react'

export default function Perfil() {
  const { user } = useAuth()
  const toast = useToast()
  const [showPwd, setShowPwd] = useState(false)
  const [saving, setSaving] = useState(false)
  const [changingPwd, setChangingPwd] = useState(false)
  const [nome, setNome] = useState(user?.name || '')
  const [cargo, setCargo] = useState('')
  const [pwdAtual, setPwdAtual] = useState('')
  const [pwdNova, setPwdNova] = useState('')
  const [pwdConf, setPwdConf] = useState('')
  const [recentes, setRecentes] = useState([])

  useEffect(() => {
    api.get('/usuarios/perfil')
      .then(({ data }) => {
        setNome(data.nome || user?.name || '')
        setCargo(data.cargo || '')
        setRecentes(data.atividades_recentes || [])
      })
      .catch(() => {})
  }, [])

  async function handleSavePerfil(e) {
    e.preventDefault()
    setSaving(true)
    try {
      await api.put('/usuarios/perfil', { nome, cargo })
      toast.success('Perfil atualizado com sucesso!')
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erro ao salvar perfil.')
    } finally {
      setSaving(false)
    }
  }

  async function handleChangePwd(e) {
    e.preventDefault()
    if (pwdNova !== pwdConf) { toast.error('As senhas novas não coincidem.'); return }
    if (pwdNova.length < 6) { toast.error('A nova senha deve ter ao menos 6 caracteres.'); return }
    setChangingPwd(true)
    try {
      await api.patch('/auth/senha', { senha_atual: pwdAtual, nova_senha: pwdNova })
      toast.success('Senha alterada com sucesso!')
      setPwdAtual(''); setPwdNova(''); setPwdConf('')
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erro ao alterar senha.')
    } finally {
      setChangingPwd(false)
    }
  }

  return (
    <Layout breadcrumb={['Meu Perfil']}>
      <div className="page-header">
        <div className="page-header-left">
          <h1>Meu Perfil</h1>
          <div className="subtitle"><span>Configurações pessoais e segurança</span></div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 20 }}>
        {/* Left — identity card */}
        <div>
          <div className="card" style={{ padding: 24, textAlign: 'center', marginBottom: 16 }}>
            <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'linear-gradient(135deg, var(--color-brand-600), var(--color-brand-800))', color: 'var(--color-text-inverse)', display: 'grid', placeItems: 'center', fontSize: 22, fontWeight: 700, margin: '0 auto 16px' }}>
              {user?.initials}
            </div>
            <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>{user?.name}</div>
            <div style={{ fontSize: 12, color: 'var(--color-text-tertiary)', marginBottom: 12 }}>{user?.email}</div>
            <span className="badge badge-admin"><Shield size={10} /> {user?.role}</span>
          </div>

          {recentes.length > 0 && (
            <div className="card">
              <div className="card-header"><span className="card-title"><Clock size={14} style={{ verticalAlign: -2 }} /> Atividade recente</span></div>
              <div>
                {recentes.slice(0, 5).map((a, i) => (
                  <div key={i} style={{ padding: '10px 16px', borderBottom: i < Math.min(recentes.length, 5) - 1 ? '1px solid var(--color-border-muted)' : 'none' }}>
                    <div style={{ fontSize: 12, fontWeight: 600 }}>{a.acao || a.descricao}</div>
                    <div style={{ fontSize: 11, color: 'var(--color-text-tertiary)', marginTop: 2 }}>
                      {a.criado_em ? new Date(a.criado_em).toLocaleString('pt-BR') : a.data}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right — edit forms */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="card">
            <div className="card-header"><span className="card-title"><User size={14} style={{ verticalAlign: -2 }} /> Dados pessoais</span></div>
            <div style={{ padding: 20 }}>
              <form onSubmit={handleSavePerfil}>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Nome completo</label>
                    <input className="input" value={nome} onChange={e => setNome(e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Email corporativo</label>
                    <input className="input" type="email" value={user?.email || ''} disabled style={{ opacity: 0.6 }} />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Cargo</label>
                  <input className="input" value={cargo} onChange={e => setCargo(e.target.value)} placeholder="Seu cargo" />
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
                  <button type="submit" className="btn btn-primary" disabled={saving}>
                    {saving
                      ? <><span style={{ width: 13, height: 13, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'var(--color-text-inverse)', borderRadius: '50%', animation: 'spin 0.65s linear infinite', display: 'inline-block' }} /> Salvando…</>
                      : <><CheckCircle size={14} /> Salvar alterações</>
                    }
                  </button>
                </div>
              </form>
            </div>
          </div>

          <div className="card">
            <div className="card-header"><span className="card-title"><Key size={14} style={{ verticalAlign: -2 }} /> Alterar senha</span></div>
            <div style={{ padding: 20 }}>
              <form onSubmit={handleChangePwd}>
                <div className="form-group">
                  <label className="form-label">Senha atual</label>
                  <div style={{ position: 'relative' }}>
                    <input className="input" type={showPwd ? 'text' : 'password'} placeholder="••••••••••••" style={{ paddingRight: 40 }}
                      value={pwdAtual} onChange={e => setPwdAtual(e.target.value)} />
                    <button type="button" onClick={() => setShowPwd(s => !s)} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-tertiary)' }}>
                      {showPwd ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Nova senha</label>
                    <input className="input" type="password" placeholder="••••••••••••" value={pwdNova} onChange={e => setPwdNova(e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Confirmar nova senha</label>
                    <input className="input" type="password" placeholder="••••••••••••" value={pwdConf} onChange={e => setPwdConf(e.target.value)} />
                  </div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <button type="submit" className="btn btn-primary" disabled={changingPwd}>
                    {changingPwd ? 'Alterando…' : 'Alterar senha'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </Layout>
  )
}
