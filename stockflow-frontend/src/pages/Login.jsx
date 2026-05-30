import { useState } from 'react'
import { useNavigate, Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { Box, Mail, Lock, Eye, EyeOff, ArrowRight, Shield, Radio, HelpCircle, AlertTriangle, Info } from 'lucide-react'

export default function Login() {
  const { login, user } = useAuth()
  const navigate = useNavigate()

  const [email, setEmail] = useState('carlos.matos@artetrigo.com.br')
  const [password, setPassword] = useState('Admin@1234')
  const [showPwd, setShowPwd] = useState(false)
  const [keepLogged, setKeepLogged] = useState(true)
  const [loading, setLoading] = useState(false)
  const [emailErr, setEmailErr] = useState('')
  const [pwdErr, setPwdErr] = useState('')
  const [apiErr, setApiErr] = useState('')

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

  const chips = [
    { label: 'LGPD',         icon: <Shield size={10} color="#4da6ff" /> },
    { label: 'RFID 915MHz',  icon: <Radio  size={10} color="#4da6ff" /> },
    { label: 'NF-e',         icon: null },
    { label: 'Câmaras Frias',icon: null },
    { label: 'Alertas FIFO', icon: null },
    { label: 'Log imutável', icon: <Shield size={10} color="#4da6ff" /> },
  ]

  return (
    <div style={{
      minHeight: '100vh',
      background: '#f0f2f5',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px 16px',
      fontFamily: '"DM Sans", "Nunito", system-ui, sans-serif',
      position: 'relative',
    }}>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700&display=swap');

        @keyframes spin    { to { transform: rotate(360deg); } }
        @keyframes dot-pulse {
          0%, 100% { box-shadow: 0 0 0 0   rgba(0,200,150,0.50); }
          50%       { box-shadow: 0 0 0 5px rgba(0,200,150,0); }
        }

        .sf-input {
          width: 100%;
          height: 42px;
          padding-left: 38px;
          padding-right: 12px;
          font-size: 13.5px;
          font-family: inherit;
          color: #0f1929;
          border: 1px solid #e0e0e0;
          border-radius: 8px;
          background: #fff;
          outline: none;
          box-sizing: border-box;
          transition: border-color 0.15s, box-shadow 0.15s;
        }
        .sf-input:focus {
          border-color: #4da6ff;
          box-shadow: 0 0 0 3px rgba(77,166,255,0.12);
        }
        .sf-input.invalid {
          border-color: #fca5a5;
          background: #fff5f5;
        }
        .sf-input-pwd { padding-right: 44px; }

        .sf-btn-submit {
          width: 100%;
          height: 44px;
          background: #1e3a5f;
          color: #fff;
          font-size: 14px;
          font-weight: 600;
          font-family: inherit;
          border-radius: 8px;
          border: none;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          letter-spacing: 0.01em;
          transition: background 0.2s;
        }
        .sf-btn-submit:hover:not(:disabled) { background: #4da6ff; }
        .sf-btn-submit:disabled { opacity: 0.7; cursor: wait; }

        .sf-btn-support {
          position: fixed;
          top: 16px;
          right: 16px;
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 8px 14px;
          border-radius: 8px;
          background: #fff;
          border: 1px solid #e0e0e0;
          color: #1e3a5f;
          font-size: 13px;
          font-weight: 600;
          font-family: inherit;
          cursor: pointer;
          box-shadow: 0 1px 4px rgba(0,0,0,0.08);
          z-index: 100;
          transition: background 0.15s, border-color 0.15s;
        }
        .sf-btn-support:hover {
          background: #f0f7ff;
          border-color: #4da6ff;
        }

        .sf-eye-btn {
          position: absolute;
          right: 4px;
          top: 50%;
          transform: translateY(-50%);
          width: 32px;
          height: 32px;
          display: grid;
          place-items: center;
          border: none;
          background: none;
          cursor: pointer;
          color: #9ca3af;
          border-radius: 6px;
          transition: color 0.15s;
        }
        .sf-eye-btn:hover { color: #1e3a5f; }

        .sf-forgot { color: #4da6ff; font-size: 12.5px; font-weight: 600; text-decoration: none; }
        .sf-forgot:hover { text-decoration: underline; }

        .sf-chip {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          font-size: 10.5px;
          font-weight: 600;
          color: #6b7280;
          padding: 4px 10px;
          border-radius: 20px;
          background: #f9fafb;
          border: 1px solid #e5e7eb;
          white-space: nowrap;
        }
      `}</style>

      {/* Suporte — fixed top-right */}
      <button className="sf-btn-support" aria-label="Suporte">
        <HelpCircle size={15} color="#4da6ff" />
        Suporte
      </button>

      {/* Card */}
      <div style={{
        width: '100%',
        maxWidth: 460,
        background: '#fff',
        borderRadius: 16,
        boxShadow: '0 4px 24px rgba(0,0,0,0.10), 0 1px 4px rgba(0,0,0,0.06)',
        padding: '40px 44px 36px',
      }}>

        {/* Logo + nome + badge */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 10 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 9,
            background: 'linear-gradient(135deg, #1e3a5f 0%, #2E75B6 100%)',
            display: 'grid', placeItems: 'center',
            boxShadow: '0 2px 8px rgba(30,58,95,0.28)',
            flexShrink: 0,
          }}>
            <Box size={18} color="#fff" />
          </div>
          <span style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.022em', color: '#0f1929' }}>
            StockFlow
          </span>
          <span style={{
            fontSize: 10, fontWeight: 700, letterSpacing: '0.09em', textTransform: 'uppercase',
            color: '#4da6ff', background: 'rgba(77,166,255,0.10)',
            border: '1px solid rgba(77,166,255,0.28)',
            padding: '3px 8px', borderRadius: 4, flexShrink: 0,
          }}>
            PROD · V1.3.0
          </span>
        </div>

        {/* Subtítulo */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, marginBottom: 32 }}>
          <span style={{
            width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
            background: '#00c896',
            animation: 'dot-pulse 2.2s ease-in-out infinite',
          }} />
          <span style={{
            fontSize: 11, fontWeight: 600, letterSpacing: '0.07em',
            textTransform: 'uppercase', color: '#6b7280',
          }}>
            Rastreabilidade de Produção · Unidade Central
          </span>
        </div>

        {/* Erro de API */}
        {apiErr && (
          <div style={{
            marginBottom: 16, padding: '10px 14px',
            background: '#fff5f5', border: '1px solid #fecaca',
            borderRadius: 8, display: 'flex', alignItems: 'flex-start',
            gap: 8, fontSize: 12.5, color: '#dc2626',
          }}>
            <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: 1 }} />
            <span>{apiErr}</span>
          </div>
        )}

        {/* Formulário */}
        <form onSubmit={handleSubmit} noValidate>

          {/* Email */}
          <div style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: '#374151', marginBottom: 5 }}>
              Email corporativo
            </label>
            <div style={{ position: 'relative' }}>
              <Mail size={15} style={{
                position: 'absolute', left: 12, top: '50%',
                transform: 'translateY(-50%)', color: '#9ca3af', pointerEvents: 'none',
              }} />
              <input
                className={`sf-input${emailErr ? ' invalid' : ''}`}
                type="email"
                value={email}
                onChange={e => { setEmail(e.target.value); setEmailErr(''); setApiErr('') }}
                placeholder="seu.nome@empresa.com"
                autoComplete="email"
              />
            </div>
            {emailErr && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 4, fontSize: 11.5, color: '#dc2626' }}>
                <AlertTriangle size={11} /><span>{emailErr}</span>
              </div>
            )}
          </div>

          {/* Senha */}
          <div style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: '#374151', marginBottom: 5 }}>
              Senha
            </label>
            <div style={{ position: 'relative' }}>
              <Lock size={15} style={{
                position: 'absolute', left: 12, top: '50%',
                transform: 'translateY(-50%)', color: '#9ca3af', pointerEvents: 'none',
              }} />
              <input
                className={`sf-input sf-input-pwd${pwdErr ? ' invalid' : ''}`}
                type={showPwd ? 'text' : 'password'}
                value={password}
                onChange={e => { setPassword(e.target.value); setPwdErr(''); setApiErr('') }}
                placeholder="••••••••••••"
                autoComplete="current-password"
              />
              <button type="button" className="sf-eye-btn" onClick={() => setShowPwd(s => !s)} aria-label={showPwd ? 'Ocultar senha' : 'Mostrar senha'}>
                {showPwd ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
            {pwdErr && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 4, fontSize: 11.5, color: '#dc2626' }}>
                <AlertTriangle size={11} /><span>{pwdErr}</span>
              </div>
            )}
          </div>

          {/* Manter conectado + Esqueci senha */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#374151', cursor: 'pointer', userSelect: 'none' }}>
              <input
                type="checkbox"
                checked={keepLogged}
                onChange={e => setKeepLogged(e.target.checked)}
                style={{ width: 15, height: 15, accentColor: '#1e3a5f', cursor: 'pointer' }}
              />
              Manter conectado
            </label>
            <a href="#" className="sf-forgot">Esqueci minha senha</a>
          </div>

          {/* Botão entrar */}
          <button type="submit" className="sf-btn-submit" disabled={loading}>
            {loading && (
              <span style={{
                width: 16, height: 16, flexShrink: 0,
                border: '2px solid rgba(255,255,255,0.3)',
                borderTopColor: '#fff',
                borderRadius: '50%',
                animation: 'spin 0.65s linear infinite',
                display: 'inline-block',
              }} />
            )}
            <span>{loading ? 'Autenticando…' : 'Entrar no Sistema'}</span>
            {!loading && <ArrowRight size={14} />}
          </button>
        </form>

        {/* Tags de recursos */}
        <div style={{ marginTop: 24, paddingTop: 20, borderTop: '1px solid #f3f4f6' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'center' }}>
            {chips.map(({ label, icon }) => (
              <span key={label} className="sf-chip">
                {icon}
                {label}
              </span>
            ))}
          </div>
        </div>

        {/* Suporte inline */}
        <div style={{
          marginTop: 16,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          fontSize: 11.5, color: '#9ca3af',
        }}>
          <Info size={12} style={{ flexShrink: 0 }} />
          <span>
            <a href="mailto:suporte@stockflow.com" style={{ color: '#6b7280', fontWeight: 500, textDecoration: 'none' }}>
              suporte@stockflow.com
            </a>
            {' '}·{' '}ramal <strong style={{ color: '#6b7280' }}>8410</strong>
          </span>
        </div>
      </div>

      {/* Rodapé — fora do card */}
      <div style={{
        marginTop: 24,
        display: 'flex', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'center',
        gap: 8, fontSize: 11, color: '#9ca3af',
      }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#00c896', display: 'inline-block' }} />
          API{' '}
          <code style={{ fontFamily: 'monospace', fontSize: 10.5, background: '#e9ecef', padding: '1px 5px', borderRadius: 3, color: '#6b7280' }}>
            v2.1.4
          </code>
        </span>
        <span style={{ opacity: 0.4 }}>·</span>
        <span>
          Tenant{' '}
          <code style={{ fontFamily: 'monospace', fontSize: 10.5, background: '#e9ecef', padding: '1px 5px', borderRadius: 3, color: '#6b7280' }}>
            stockflow
          </code>
        </span>
        <span style={{ opacity: 0.4 }}>·</span>
        <span>© 2026 StockFlow</span>
      </div>

    </div>
  )
}
