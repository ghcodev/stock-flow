import { useState } from 'react'
import { useNavigate, Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { Package, Mail, Lock, Eye, EyeOff, ArrowRight, AlertTriangle } from 'lucide-react'

export default function Login() {
  const { login, user } = useAuth()
  const navigate = useNavigate()

  const [email, setEmail]       = useState('carlos.matos@artetrigo.com.br')
  const [password, setPassword] = useState('Admin@1234')
  const [showPwd, setShowPwd]   = useState(false)
  const [loading, setLoading]   = useState(false)
  const [emailErr, setEmailErr] = useState('')
  const [pwdErr, setPwdErr]     = useState('')
  const [apiErr, setApiErr]     = useState('')

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
    <div style={{
      minHeight: '100vh',
      background: 'var(--color-bg-canvas)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px 16px',
    }}>

      <style>{`
        @keyframes sf-spin { to { transform: rotate(360deg); } }
        @keyframes sf-pulse {
          0%, 100% { box-shadow: 0 0 0 0   var(--color-pulse-success-start); }
          50%       { box-shadow: 0 0 0 6px transparent; }
        }

        .sf-card {
          width: 100%;
          max-width: 420px;
          background: var(--color-bg-default);
          border: 1px solid var(--color-border-default);
          border-radius: var(--radius-xl);
          box-shadow: var(--shadow-lg);
          overflow: hidden;
        }

        .sf-card-head {
          background: linear-gradient(135deg, var(--color-brand-600), var(--color-brand-800));
          padding: 28px 32px;
          display: flex;
          align-items: center;
          gap: 14px;
          color: var(--color-text-inverse);
        }

        .sf-card-body { padding: 28px 32px; }

        .sf-card-foot {
          border-top: 1px solid var(--color-border-muted);
          padding: 16px 32px;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .sf-live-dot {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: var(--color-success-600);
          animation: sf-pulse 2.2s ease-in-out infinite;
          flex-shrink: 0;
        }

        .sf-label {
          display: block;
          font-size: 12.5px;
          font-weight: 600;
          color: var(--color-text-secondary);
          margin-bottom: 5px;
        }

        .sf-input-wrap { position: relative; }

        .sf-input-icon {
          position: absolute;
          left: 11px;
          top: 50%;
          transform: translateY(-50%);
          color: var(--color-text-tertiary);
          pointer-events: none;
          display: flex;
          align-items: center;
        }

        .sf-input {
          width: 100%;
          height: 40px;
          padding-left: 36px;
          padding-right: 12px;
          font-size: 13.5px;
          font-family: inherit;
          color: var(--color-text-primary);
          background: var(--color-bg-default);
          border: 1px solid var(--color-border-default);
          border-radius: var(--radius-lg);
          outline: none;
          box-sizing: border-box;
          transition: border-color 0.15s, box-shadow 0.15s;
        }
        .sf-input:focus {
          border-color: var(--color-border-focus);
          box-shadow: 0 0 0 3px var(--color-focus-ring);
        }
        .sf-input.invalid {
          border-color: var(--color-danger-200);
          background: var(--color-danger-50);
        }
        .sf-input.invalid:focus {
          border-color: var(--color-danger-500);
          box-shadow: 0 0 0 3px var(--color-focus-ring-danger);
        }
        .sf-input-pwd { padding-right: 40px; }

        .sf-eye {
          position: absolute;
          right: 4px;
          top: 50%;
          transform: translateY(-50%);
          width: 32px;
          height: 32px;
          display: grid;
          place-items: center;
          background: none;
          border: none;
          cursor: pointer;
          color: var(--color-text-tertiary);
          border-radius: var(--radius-md);
          transition: color 0.15s;
        }
        .sf-eye:hover { color: var(--color-text-secondary); }

        .sf-field-error {
          display: flex;
          align-items: center;
          gap: 5px;
          font-size: 11.5px;
          color: var(--color-danger-600);
          margin-top: 4px;
        }

        .sf-api-error {
          display: flex;
          align-items: flex-start;
          gap: 8px;
          padding: 10px 12px;
          background: var(--color-danger-50);
          border: 1px solid var(--color-danger-200);
          border-radius: var(--radius-lg);
          font-size: 12.5px;
          color: var(--color-danger-600);
          margin-bottom: 18px;
        }

        .sf-btn {
          width: 100%;
          height: 44px;
          background: linear-gradient(135deg, var(--color-brand-600), var(--color-brand-800));
          color: var(--color-text-inverse);
          font-size: 14px;
          font-weight: 600;
          font-family: inherit;
          border: none;
          border-radius: var(--radius-lg);
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          transition: opacity 0.15s;
          letter-spacing: 0.01em;
        }
        .sf-btn:hover:not(:disabled) { opacity: 0.88; }
        .sf-btn:disabled { opacity: 0.65; cursor: wait; }

        .sf-spinner {
          width: 16px;
          height: 16px;
          border: 2px solid transparent;
          border-top-color: var(--color-text-inverse);
          border-radius: 50%;
          animation: sf-spin 0.65s linear infinite;
          flex-shrink: 0;
        }

        .sf-code {
          font-family: var(--font-data);
          font-size: 11px;
          background: var(--color-bg-subtle);
          color: var(--color-text-secondary);
          padding: 2px 7px;
          border-radius: var(--radius-sm);
        }
      `}</style>

      <div className="sf-card">

        {/* Topo — gradiente brand */}
        <div className="sf-card-head">
          <Package size={28} strokeWidth={1.75} />
          <div>
            <div style={{ fontSize: 19, fontWeight: 700, lineHeight: 1.2 }}>StockFlow</div>
            <div style={{ fontSize: 12, color: 'var(--color-brand-200)', marginTop: 2 }}>
              Enterprise v2.0
            </div>
          </div>
        </div>

        {/* Corpo — formulário */}
        <div className="sf-card-body">

          {apiErr && (
            <div className="sf-api-error">
              <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: 1 }} />
              <span>{apiErr}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate>

            {/* E-mail */}
            <div style={{ marginBottom: 14 }}>
              <label className="sf-label" htmlFor="sf-email">E-mail</label>
              <div className="sf-input-wrap">
                <span className="sf-input-icon"><Mail size={15} /></span>
                <input
                  id="sf-email"
                  className={`sf-input${emailErr ? ' invalid' : ''}`}
                  type="email"
                  value={email}
                  onChange={e => { setEmail(e.target.value); setEmailErr(''); setApiErr('') }}
                  placeholder="seu.nome@empresa.com"
                  autoComplete="email"
                />
              </div>
              {emailErr && (
                <div className="sf-field-error">
                  <AlertTriangle size={11} /><span>{emailErr}</span>
                </div>
              )}
            </div>

            {/* Senha */}
            <div style={{ marginBottom: 22 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5 }}>
                <label className="sf-label" htmlFor="sf-senha" style={{ marginBottom: 0 }}>Senha</label>
                <a href="#" style={{ fontSize: 12, color: 'var(--color-text-link)', fontWeight: 500, textDecoration: 'none' }}>
                  Esqueci minha senha
                </a>
              </div>
              <div className="sf-input-wrap">
                <span className="sf-input-icon"><Lock size={15} /></span>
                <input
                  id="sf-senha"
                  className={`sf-input sf-input-pwd${pwdErr ? ' invalid' : ''}`}
                  type={showPwd ? 'text' : 'password'}
                  value={password}
                  onChange={e => { setPassword(e.target.value); setPwdErr(''); setApiErr('') }}
                  placeholder="••••••••••••"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  className="sf-eye"
                  onClick={() => setShowPwd(s => !s)}
                  aria-label={showPwd ? 'Ocultar senha' : 'Mostrar senha'}
                >
                  {showPwd ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
              {pwdErr && (
                <div className="sf-field-error">
                  <AlertTriangle size={11} /><span>{pwdErr}</span>
                </div>
              )}
            </div>

            <button type="submit" className="sf-btn" disabled={loading}>
              {loading
                ? <><span className="sf-spinner" />Autenticando…</>
                : <><span>Entrar</span><ArrowRight size={14} /></>
              }
            </button>

          </form>
        </div>

        {/* Rodapé */}
        <div className="sf-card-foot">
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12, color: 'var(--color-text-tertiary)' }}>
            <span className="sf-live-dot" />
            Sistema online
          </div>
          <span className="sf-code">v1.3.0</span>
        </div>

      </div>
    </div>
  )
}
