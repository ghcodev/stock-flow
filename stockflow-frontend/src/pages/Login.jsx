import { useState } from 'react'
import { useNavigate, Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { Box, Mail, Lock, Eye, EyeOff, ArrowRight, Shield, Radio, HelpCircle, Sun, Moon, AlertTriangle, Info } from 'lucide-react'

export default function Login() {
  const { login, user } = useAuth()
  const navigate = useNavigate()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPwd, setShowPwd] = useState(false)
  const [keepLogged, setKeepLogged] = useState(true)
  const [loading, setLoading] = useState(false)
  const [emailErr, setEmailErr] = useState('')
  const [pwdErr, setPwdErr] = useState('')
  const [apiErr, setApiErr] = useState('')
  const [dark, setDark] = useState(false)

  if (user) return <Navigate to="/dashboard" replace />

  function validateEmail(v) {
    if (!v.trim()) return 'Email é obrigatório.'
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v)) return 'Formato de email inválido.'
    return ''
  }

  async function handleSubmit(e) {
    e.preventDefault()
    const eErr = validateEmail(email)
    const pErr = password.trim().length < 6 ? 'Senha deve ter ao menos 6 caracteres.' : ''
    setEmailErr(eErr)
    setPwdErr(pErr)
    if (eErr || pErr) return

    setLoading(true)
    setApiErr('')
    try {
      await login(email, password)
      navigate('/dashboard')
    } catch (err) {
      setApiErr(err.response?.data?.error || 'Erro ao autenticar. Verifique suas credenciais.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1.05fr 0.95fr', height: '100vh', overflow: 'hidden', background: 'var(--color-bg-canvas)' }}>

      {/* LEFT — institutional pane */}
      <aside style={{
        background: 'radial-gradient(circle at 18% 110%, rgba(46,117,182,0.35) 0%, transparent 55%), radial-gradient(circle at 92% -10%, rgba(31,56,100,0.40) 0%, transparent 50%), linear-gradient(135deg, #0c1a2e 0%, #142244 65%, #1F3864 100%)',
        color: '#fff', padding: '40px 56px', display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden',
      }}>
        <header style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 38, height: 38, borderRadius: 9, background: 'linear-gradient(135deg,#2E75B6 0%,#254d8c 100%)', display: 'grid', placeItems: 'center', boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.18), 0 2px 6px rgba(0,0,0,0.30)' }}>
            <Box size={20} color="#fff" />
          </div>
          <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-0.015em' }}>StockFlow</div>
          <div style={{ marginLeft: 'auto', fontSize: 10, fontWeight: 700, letterSpacing: '0.10em', textTransform: 'uppercase', color: '#7dd3fc', background: 'rgba(46,117,182,0.18)', border: '1px solid rgba(46,117,182,0.40)', padding: '4px 8px', borderRadius: 4 }}>
            Prod · v2.1.4
          </div>
        </header>

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', maxWidth: 520 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#7dd3fc', marginBottom: 18 }}>
            <span className="live-dot" style={{ background: '#22c55e', boxShadow: '0 0 0 3px rgba(34,197,94,0.22)' }} />
            Plataforma operacional · CD-01
          </div>
          <h1 style={{ fontSize: 36, fontWeight: 700, letterSpacing: '-0.035em', lineHeight: 1.12, color: '#fff', marginBottom: 14 }}>
            Rastreabilidade <em style={{ fontStyle: 'normal', color: '#7dd3fc' }}>RFID</em> em tempo real para sua cadeia de suprimentos.
          </h1>
          <p style={{ fontSize: 14, lineHeight: 1.65, color: '#94a3b8', maxWidth: 440 }}>
            StockFlow centraliza entrada, saída, transferência e auditoria de lotes em um único sistema validado. Conformidade LGPD, log imutável de 7 anos e integração nativa com SAP.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', marginTop: 36, borderTop: '1px solid rgba(255,255,255,0.10)', borderBottom: '1px solid rgba(255,255,255,0.10)' }}>
            {[
              { v: '3.842', l: 'Movimentações hoje' },
              { v: '1.182 / 1.440', l: 'Posições ocupadas' },
              { v: '99,7%', l: 'SLA · uptime 30d' },
            ].map((s, i) => (
              <div key={i} style={{ padding: '18px 22px 16px', borderRight: i < 2 ? '1px solid rgba(255,255,255,0.10)' : 'none' }}>
                <div style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-0.03em', color: '#fff' }}>{s.v}</div>
                <div style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#64748b', marginTop: 5 }}>{s.l}</div>
              </div>
            ))}
          </div>

          <div style={{ marginTop: 32, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.10em', textTransform: 'uppercase', color: '#64748b' }}>Conformidade & integrações</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 18, flexWrap: 'wrap' }}>
              {['LGPD', 'ISO 27001', 'ANVISA RDC 430', 'RFID 915MHz', 'SAP S/4HANA', 'Azure AD'].map(chip => (
                <span key={chip} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11.5, fontWeight: 600, color: '#cbd5e1', padding: '5px 10px', borderRadius: 5, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.10)' }}>
                  {chip.includes('RFID') ? <Radio size={11} color="#7dd3fc" /> : chip.includes('LGPD') || chip.includes('ISO') || chip.includes('ANVISA') ? <Shield size={11} color="#7dd3fc" /> : null}
                  {chip}
                </span>
              ))}
            </div>
          </div>
        </div>

        <footer style={{ marginTop: 'auto', paddingTop: 28, display: 'flex', alignItems: 'center', gap: 14, fontSize: 11, color: '#64748b', flexWrap: 'wrap' }}>
          <span className="live-dot" style={{ background: '#22c55e', boxShadow: '0 0 0 3px rgba(34,197,94,0.22)', width: 6, height: 6, borderRadius: '50%', display: 'inline-block' }} />
          <span>API <code style={{ fontFamily: '"IBM Plex Mono",monospace', color: '#94a3b8', background: 'rgba(255,255,255,0.05)', padding: '2px 6px', borderRadius: 3, fontSize: 10.5 }}>v2.1.4</code></span>
          <span style={{ opacity: 0.4 }}>·</span>
          <span>Tenant <code style={{ fontFamily: '"IBM Plex Mono",monospace', color: '#94a3b8', background: 'rgba(255,255,255,0.05)', padding: '2px 6px', borderRadius: 3, fontSize: 10.5 }}>acme-pharma</code></span>
          <span style={{ marginLeft: 'auto' }}>© 2026 ACME Logística</span>
        </footer>
      </aside>

      {/* RIGHT — form pane */}
      <section style={{ background: 'var(--color-bg-default)', padding: '40px 56px', display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 'auto' }}>
          <button className="icon-btn" aria-label="Ajuda"><HelpCircle size={16} /></button>
          <button className="icon-btn" onClick={() => {
            setDark(d => !d)
            document.documentElement.dataset.theme = dark ? '' : 'dark'
          }} aria-label="Tema">
            {dark ? <Sun size={16} /> : <Moon size={16} />}
          </button>
        </div>

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', maxWidth: 380, width: '100%', margin: '0 auto', padding: '36px 0' }}>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--color-text-tertiary)', marginBottom: 8 }}>
            Acesso restrito
          </div>
          <h2 style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-0.025em', color: 'var(--color-text-primary)', lineHeight: 1.2 }}>
            Entrar na sua conta
          </h2>
          <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginTop: 6, lineHeight: 1.55 }}>
            Use suas credenciais corporativas. O acesso é registrado em log de auditoria imutável.
          </p>

          {apiErr && (
            <div className="form-error" style={{ marginTop: 20, padding: '10px 14px', background: 'var(--color-danger-50)', border: '1px solid var(--color-danger-200)', borderRadius: 8 }}>
              <AlertTriangle size={13} /><span>{apiErr}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate style={{ marginTop: 28 }}>
            <div style={{ marginBottom: 14 }}>
              <label className="form-label">Email corporativo</label>
              <div className="input-prefix">
                <Mail size={15} />
                <input
                  className={`input${emailErr ? ' invalid' : ''}`}
                  type="email"
                  value={email}
                  onChange={e => { setEmail(e.target.value); setEmailErr(''); setApiErr('') }}
                  placeholder="seu.nome@empresa.com"
                  style={{ height: 40, fontSize: 13.5 }}
                  autoComplete="email"
                />
              </div>
              {emailErr && <div className="form-error"><AlertTriangle size={13} /><span>{emailErr}</span></div>}
            </div>

            <div style={{ marginBottom: 14 }}>
              <label className="form-label">Senha</label>
              <div style={{ position: 'relative' }}>
                <div className="input-prefix">
                  <Lock size={15} />
                  <input
                    className={`input${pwdErr ? ' invalid' : ''}`}
                    type={showPwd ? 'text' : 'password'}
                    value={password}
                    onChange={e => { setPassword(e.target.value); setPwdErr(''); setApiErr('') }}
                    placeholder="••••••••••••"
                    style={{ height: 40, fontSize: 13.5, paddingRight: 42 }}
                    autoComplete="current-password"
                  />
                </div>
                <button type="button" onClick={() => setShowPwd(s => !s)} style={{ position: 'absolute', right: 4, top: '50%', transform: 'translateY(-50%)', width: 32, height: 32, display: 'grid', placeItems: 'center', borderRadius: 6, color: 'var(--color-text-tertiary)', background: 'none', border: 'none', cursor: 'pointer' }}>
                  {showPwd ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
              {pwdErr && <div className="form-error"><AlertTriangle size={13} /><span>{pwdErr}</span></div>}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 6 }}>
              <label className="checkbox">
                <input type="checkbox" checked={keepLogged} onChange={e => setKeepLogged(e.target.checked)} />
                <span className="box">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                </span>
                Manter conectado
              </label>
              <a href="#" style={{ fontSize: 12.5, color: 'var(--color-brand-600)', fontWeight: 600 }}>Esqueci minha senha</a>
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{ marginTop: 20, width: '100%', height: 44, background: 'var(--color-brand-800)', color: '#fff', fontSize: 14, fontWeight: 600, borderRadius: 8, border: 'none', cursor: loading ? 'wait' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, opacity: loading ? 0.7 : 1 }}
            >
              {loading && <span style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.65s linear infinite', display: 'inline-block' }} />}
              <span>{loading ? 'Autenticando…' : 'Entrar no StockFlow'}</span>
              {!loading && <ArrowRight size={14} />}
            </button>
          </form>

          <div style={{ marginTop: 32, display: 'flex', alignItems: 'center', gap: 8, fontSize: 11.5, color: 'var(--color-text-tertiary)', paddingTop: 18, borderTop: '1px solid var(--color-border-default)' }}>
            <Info size={13} style={{ flexShrink: 0 }} />
            <span>Problemas para entrar? Contate <a href="mailto:suporte@empresa.com" style={{ color: 'var(--color-text-secondary)', fontWeight: 500, textDecoration: 'underline' }}>suporte@empresa.com</a> ou ligue para o ramal <strong style={{ color: 'var(--color-text-secondary)' }}>8410</strong>.</span>
          </div>
        </div>
      </section>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @media (max-width: 980px) {
          div[style*="grid-template-columns: 1.05fr"] { grid-template-columns: 1fr !important; height: auto !important; min-height: 100vh; }
        }
      `}</style>
    </div>
  )
}
