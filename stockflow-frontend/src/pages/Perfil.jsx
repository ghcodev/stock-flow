import { useState, useEffect } from 'react'
import Layout from '../components/Layout.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { useToast } from '../context/ToastContext.jsx'
import api from '../api/axios.js'
import {
  User, Shield, Key, Clock, CheckCircle, Eye, EyeOff,
  Building, Calendar, LogOut, Settings, Lock,
} from 'lucide-react'

/* ─── Helpers ──────────────────────────────────────────────── */
function getInitials(name) {
  const parts = (name || '').trim().split(' ')
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  return (parts[0] || '?').slice(0, 2).toUpperCase()
}

function fmtDate(value) {
  return value ? new Date(value).toLocaleDateString('pt-BR') : '—'
}

function fmtAccess(value) {
  if (!value) return 'Agora'
  const d = new Date(value)
  if (isNaN(d.getTime())) return 'Agora'
  return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

function pwdStrength(pwd) {
  if (!pwd) return null
  const len        = pwd.length
  const hasNum     = /\d/.test(pwd)
  const hasSpecial = /[^a-zA-Z0-9]/.test(pwd)
  if (len >= 10 && (hasNum || hasSpecial)) return { label: 'Forte', pct: 100, color: 'var(--color-success-500)' }
  if (len >= 6)                            return { label: 'Média', pct: 66,  color: 'var(--color-warning-500)' }
  return                                          { label: 'Fraca', pct: 33,  color: 'var(--color-danger-500)'  }
}

/* ─── Toggle switch ────────────────────────────────────────── */
function Toggle({ checked, onChange, label }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid var(--color-border-muted)' }}>
      <span style={{ fontSize: 13, color: 'var(--color-text-primary)' }}>{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        style={{
          width: 36, height: 20, borderRadius: 10, border: 'none', flexShrink: 0,
          background: checked ? 'var(--color-brand-600)' : 'var(--color-border-default)',
          position: 'relative', cursor: 'pointer', transition: 'background 150ms ease',
        }}
      >
        <span style={{
          position: 'absolute', top: 2, left: checked ? 18 : 2,
          width: 16, height: 16, borderRadius: '50%',
          background: 'var(--color-bg-default)',
          transition: 'left 150ms ease',
          boxShadow: 'var(--shadow-xs)',
        }} />
      </button>
    </div>
  )
}

/* ─── KPI card ─────────────────────────────────────────────── */
function PrfKpiCard({ icon: Icon, label, badge, value, valueStyle }) {
  return (
    <div className="prf-kpi-card">
      <div className="prf-kpi-icon"><Icon size={16} /></div>
      <div style={{ minWidth: 0 }}>
        <div className="prf-kpi-label">{label}</div>
        {badge
          ? <div style={{ marginTop: 4 }}>{badge}</div>
          : <div className="prf-kpi-value" style={valueStyle}>{value}</div>
        }
      </div>
    </div>
  )
}

/* ─── Main component ───────────────────────────────────────── */
export default function Perfil() {
  const { user, logout } = useAuth()
  const toast = useToast()

  const [showPwd,       setShowPwd]       = useState(false)
  const [saving,        setSaving]        = useState(false)
  const [changingPwd,   setChangingPwd]   = useState(false)
  const [nome,          setNome]          = useState(user?.name || '')
  const [cargo,         setCargo]         = useState('')
  const [pwdAtual,      setPwdAtual]      = useState('')
  const [pwdNova,       setPwdNova]       = useState('')
  const [pwdConf,       setPwdConf]       = useState('')

  // Session timer
  const [sessionStart]    = useState(Date.now())
  const [sessionMinutes,   setSessionMinutes] = useState(0)

  // Preferences
  const [darkMode,        setDarkMode]        = useState(() => document.documentElement.classList.contains('dark') || localStorage.getItem('stockflow_theme') === 'dark')
  const [notifVencimento, setNotifVencimento] = useState(() => localStorage.getItem('stockflow_notif_vencimento') !== 'false')
  const [notifSom,        setNotifSom]        = useState(() => localStorage.getItem('stockflow_notif_som') === 'true')

  /* ── Effects ─────────────────────────────────────────────── */
  useEffect(() => {
    api.get('/usuarios/perfil')
      .then(({ data }) => {
        setNome(data.nome || user?.name || '')
        setCargo(data.cargo || '')
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    const interval = setInterval(() => {
      setSessionMinutes(Math.floor((Date.now() - sessionStart) / 60000))
    }, 60000)
    return () => clearInterval(interval)
  }, [sessionStart])

  /* ── Preference handlers ─────────────────────────────────── */
  function handleDarkMode(value) {
    setDarkMode(value)
    if (value) { document.documentElement.classList.add('dark'); localStorage.setItem('stockflow_theme', 'dark') }
    else       { document.documentElement.classList.remove('dark'); localStorage.setItem('stockflow_theme', 'light') }
  }

  function handleNotifVencimento(value) {
    setNotifVencimento(value)
    localStorage.setItem('stockflow_notif_vencimento', String(value))
  }

  function handleNotifSom(value) {
    setNotifSom(value)
    localStorage.setItem('stockflow_notif_som', String(value))
  }

  /* ── API handlers (unchanged) ────────────────────────────── */
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
    if (pwdNova.length < 6)  { toast.error('A nova senha deve ter ao menos 6 caracteres.'); return }
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

  /* ── Computed ────────────────────────────────────────────── */
  const userInitials   = user?.initials || getInitials(user?.name)
  const roleCls        = (user?.perfil || user?.role || '').toLowerCase() === 'administrador' ? 'badge-admin' : 'badge-info'
  const roleLabel      = user?.perfil || user?.role || '—'
  const strength       = pwdStrength(pwdNova)

  /* ── Render ──────────────────────────────────────────────── */
  return (
    <Layout breadcrumb={['Meu Perfil']}>
      <div className="page-header">
        <div className="page-header-left">
          <h1>Meu Perfil</h1>
          <div className="subtitle"><span>Configurações pessoais e segurança</span></div>
        </div>
      </div>

      {/* KPI Strip */}
      <div className="prf-kpi-grid">
        <PrfKpiCard
          icon={Shield}
          label="Perfil"
          badge={<span className={`badge ${roleCls}`}><Shield size={10} /> {roleLabel}</span>}
        />
        <PrfKpiCard
          icon={Calendar}
          label="Membro desde"
          value={fmtDate(user?.criado_em)}
          valueStyle={{ fontSize: 15, lineHeight: 1.3, fontWeight: 800 }}
        />
        <PrfKpiCard
          icon={Clock}
          label="Sessão atual"
          value={`${sessionMinutes} min`}
        />
        <PrfKpiCard
          icon={User}
          label="Último acesso"
          value={fmtAccess(user?.ultimo_acesso)}
          valueStyle={{ fontSize: 14, lineHeight: 1.3, fontWeight: 800 }}
        />
      </div>

      {/* Two-column layout */}
      <div style={{ display: 'grid', gridTemplateColumns: '35% 1fr', gap: 20 }}>

        {/* ─── Left — identity card ──────────────────────── */}
        <div>
          <div className="card" style={{ padding: 24 }}>
            {/* Avatar */}
            <div style={{ textAlign: 'center', marginBottom: 20 }}>
              <div style={{
                width: 80, height: 80, borderRadius: '50%',
                background: 'var(--color-brand-600)',
                color: 'var(--color-text-inverse)',
                display: 'grid', placeItems: 'center',
                fontSize: 28, fontWeight: 700,
                margin: '0 auto 14px',
              }}>
                {userInitials}
              </div>
              <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--color-text-primary)', marginBottom: 4 }}>{user?.name || nome}</div>
              <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginBottom: 10 }}>{user?.email}</div>
              <span className={`badge ${roleCls}`}><Shield size={10} /> {roleLabel}</span>
            </div>

            <div style={{ borderTop: '1px solid var(--color-border-muted)', paddingTop: 16, marginBottom: 16 }}>
              {[
                { icon: Building,  text: 'Arte Trigo' },
                { icon: Calendar,  text: user?.criado_em ? `Membro desde ${fmtDate(user.criado_em)}` : 'Membro desde —' },
                { icon: Shield,    text: roleLabel },
              ].map(({ icon: Icon, text }) => (
                <div key={text} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--color-text-secondary)', padding: '7px 0' }}>
                  <Icon size={14} style={{ color: 'var(--color-text-tertiary)', flexShrink: 0 }} />
                  <span>{text}</span>
                </div>
              ))}
            </div>

            <div style={{ borderTop: '1px solid var(--color-border-muted)', paddingTop: 16 }}>
              <button
                type="button"
                className="btn btn-outline"
                style={{ width: '100%', justifyContent: 'center', color: 'var(--color-danger-600)', borderColor: 'var(--color-danger-200)', background: 'var(--color-danger-50)' }}
                onClick={() => logout?.()}
              >
                <LogOut size={14} /> Fazer logout
              </button>
              <div style={{ marginTop: 10, fontSize: 11, color: 'var(--color-text-tertiary)', textAlign: 'center' }}>
                Sessão expira em 8h · Token JWT
              </div>
            </div>
          </div>
        </div>

        {/* ─── Right — configuration sections ──────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Dados pessoais */}
          <div className="card">
            <div className="card-header">
              <span className="card-title"><User size={14} style={{ verticalAlign: -2 }} /> Dados pessoais</span>
            </div>
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
                      ? <><span style={{ width: 13, height: 13, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'var(--color-text-inverse)', borderRadius: '50%', animation: 'prf-spin 0.65s linear infinite', display: 'inline-block' }} /> Salvando…</>
                      : <><CheckCircle size={14} /> Salvar alterações</>
                    }
                  </button>
                </div>
              </form>
            </div>
          </div>

          {/* Segurança */}
          <div className="card">
            <div className="card-header">
              <span className="card-title"><Lock size={14} style={{ verticalAlign: -2 }} /> Segurança</span>
            </div>
            <div style={{ padding: 20 }}>
              <form onSubmit={handleChangePwd}>
                <div className="form-group">
                  <label className="form-label">Senha atual</label>
                  <div style={{ position: 'relative' }}>
                    <input
                      className="input"
                      type={showPwd ? 'text' : 'password'}
                      placeholder="••••••••••••"
                      style={{ paddingRight: 40 }}
                      value={pwdAtual}
                      onChange={e => setPwdAtual(e.target.value)}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPwd(s => !s)}
                      aria-label={showPwd ? 'Ocultar senha' : 'Mostrar senha'}
                      style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-tertiary)', display: 'grid', placeItems: 'center', width: 20, height: 20 }}
                    >
                      {showPwd ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Nova senha</label>
                    <input className="input" type="password" placeholder="••••••••••••" value={pwdNova} onChange={e => setPwdNova(e.target.value)} />
                    {/* Password strength indicator */}
                    {strength && (
                      <div style={{ marginTop: 6 }}>
                        <div style={{ height: 4, background: 'var(--color-bg-muted)', borderRadius: 2, overflow: 'hidden' }}>
                          <div style={{ width: `${strength.pct}%`, height: '100%', background: strength.color, borderRadius: 2, transition: 'width 200ms ease, background 200ms ease' }} />
                        </div>
                        <div style={{ marginTop: 4, fontSize: 11, fontWeight: 700, color: strength.color }}>{strength.label}</div>
                      </div>
                    )}
                  </div>
                  <div className="form-group">
                    <label className="form-label">Confirmar nova senha</label>
                    <input className="input" type="password" placeholder="••••••••••••" value={pwdConf} onChange={e => setPwdConf(e.target.value)} />
                  </div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <button type="submit" className="btn btn-primary" disabled={changingPwd}>
                    {changingPwd
                      ? <><span style={{ width: 13, height: 13, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'var(--color-text-inverse)', borderRadius: '50%', animation: 'prf-spin 0.65s linear infinite', display: 'inline-block' }} /> Alterando…</>
                      : <><Key size={14} /> Alterar senha</>
                    }
                  </button>
                </div>
              </form>
            </div>
          </div>

          {/* Preferências */}
          <div className="card">
            <div className="card-header">
              <span className="card-title"><Settings size={14} style={{ verticalAlign: -2 }} /> Preferências</span>
            </div>
            <div style={{ padding: '4px 20px 16px' }}>
              <Toggle label="Tema escuro"                 checked={darkMode}        onChange={handleDarkMode} />
              <Toggle label="Notificações de vencimento"  checked={notifVencimento} onChange={handleNotifVencimento} />
              <Toggle label="Som de alertas"              checked={notifSom}        onChange={handleNotifSom} />
            </div>
          </div>

        </div>
      </div>

      <style>{`
        @keyframes prf-spin { to { transform:rotate(360deg) } }

        .prf-kpi-grid { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:12px; margin-bottom:20px }
        .prf-kpi-card { display:flex; align-items:center; gap:12px; min-height:74px; padding:12px 14px; background:var(--color-bg-default); border:1px solid var(--color-border-default); border-radius:var(--radius-md); box-shadow:var(--shadow-xs) }
        .prf-kpi-icon { width:30px; height:30px; display:grid; place-items:center; background:var(--color-bg-subtle); border:1px solid var(--color-border-muted); border-radius:var(--radius-sm); flex-shrink:0; color:var(--color-text-secondary) }
        .prf-kpi-label { font-size:10px; font-weight:700; color:var(--color-text-tertiary); text-transform:uppercase; letter-spacing:0.08em }
        .prf-kpi-value { margin-top:2px; font-size:26px; line-height:1; font-weight:800; color:var(--color-text-primary); font-variant-numeric:tabular-nums }

        @media(max-width:1180px) { .prf-kpi-grid{grid-template-columns:repeat(2,minmax(0,1fr))} }
        @media(max-width:700px)  { .prf-kpi-grid{grid-template-columns:1fr} }
      `}</style>
    </Layout>
  )
}
