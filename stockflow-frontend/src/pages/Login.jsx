import { useState, useEffect } from 'react'
import { useNavigate, Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import api from '../api/axios.js'
import { Box, Lock, Eye, EyeOff, Hash, CheckCircle, LogIn } from 'lucide-react'

export default function Login() {
  const { login, user } = useAuth()
  const navigate = useNavigate()

  const [codigo, setCodigo]                   = useState('')
  const [nomeUsuario, setNomeUsuario]         = useState('')
  const [buscandoUsuario, setBuscandoUsuario] = useState(false)
  const [usuarioEncontrado, setUsuarioEncontrado] = useState(false)
  const [senha, setSenha]     = useState('')
  const [erro, setErro]       = useState('')
  const [loading, setLoading] = useState(false)
  const [showSenha, setShowSenha] = useState(false)

  useEffect(() => {
    if (!codigo || codigo.length === 0) {
      setNomeUsuario('')
      setUsuarioEncontrado(false)
      setErro('')
      return
    }
    const timer = setTimeout(async () => {
      setBuscandoUsuario(true)
      try {
        const res = await api.get(`/auth/usuario-por-codigo/${codigo}`)
        if (res.data.encontrado) {
          setNomeUsuario(res.data.nome)
          setUsuarioEncontrado(true)
          setErro('')
          document.getElementById('campo-senha')?.focus()
        } else {
          setNomeUsuario('')
          setUsuarioEncontrado(false)
          if (codigo.length >= 1) setErro('Código não encontrado')
        }
      } catch {
        setNomeUsuario('')
        setUsuarioEncontrado(false)
      } finally {
        setBuscandoUsuario(false)
      }
    }, 400)
    return () => clearTimeout(timer)
  }, [codigo])

  if (user) return <Navigate to="/dashboard" replace />

  async function handleSubmit(e) {
    e.preventDefault()
    if (!usuarioEncontrado) { setErro('Digite um código de operador válido'); return }
    if (!senha) { setErro('Digite sua senha'); return }
    setLoading(true)
    setErro('')
    try {
      await login(codigo, senha)
      navigate('/dashboard')
    } catch (err) {
      setErro(err.response?.data?.error || 'Código ou senha incorretos')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'contents' }}>
      <div style={{
        minHeight: '100vh',
        background: 'var(--color-bg-canvas)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px 16px',
        position: 'relative',
        overflow: 'hidden',
      }}>

        <style>{`
          @keyframes fadeIn {
            from { opacity: 0; transform: translateY(-4px); }
            to   { opacity: 1; transform: translateY(0); }
          }
          @keyframes spin { to { transform: rotate(360deg); } }

          input[type=number]::-webkit-outer-spin-button,
          input[type=number]::-webkit-inner-spin-button { -webkit-appearance: none; }
          input[type=number] { -moz-appearance: textfield; }

          .sf-code-input {
            width: 100%;
            padding: 10px 12px 10px 38px;
            border-radius: var(--radius-md);
            font-size: 18px;
            font-weight: 700;
            font-variant-numeric: tabular-nums;
            font-family: var(--font-data);
            outline: none;
            background: var(--color-bg-default);
            color: var(--color-text-primary);
            transition: border-color 0.2s, box-shadow 0.2s;
            box-sizing: border-box;
          }
          .sf-code-input:focus {
            border-color: var(--color-border-focus);
            box-shadow: 0 0 0 3px var(--color-focus-ring);
          }

          .sf-senha-input {
            width: 100%;
            padding: 10px 40px 10px 38px;
            border-radius: var(--radius-md);
            font-size: 14px;
            outline: none;
            color: var(--color-text-primary);
            transition: border-color 0.2s, box-shadow 0.2s;
            box-sizing: border-box;
          }
          .sf-senha-input:not(:disabled):focus {
            border-color: var(--color-border-focus);
            box-shadow: 0 0 0 3px var(--color-focus-ring);
          }

          .sf-submit-btn {
            width: 100%;
            height: 44px;
            border: none;
            border-radius: var(--radius-md);
            font-size: 15px;
            font-weight: 600;
            font-family: inherit;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            transition: opacity 0.15s, background 0.2s;
          }
          .sf-submit-btn:not(:disabled):hover { opacity: 0.88; }
        `}</style>

        {/* Padrão de grid SVG */}
        <svg style={{
          position: 'absolute', inset: 0, width: '100%', height: '100%',
          opacity: 0.4, pointerEvents: 'none',
        }} xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="sf-grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none"
                stroke="var(--color-border-default)" strokeWidth="0.8" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#sf-grid)" />
        </svg>

        {/* Círculos decorativos brand */}
        <div style={{
          position: 'absolute', top: -120, right: -120,
          width: 400, height: 400, borderRadius: '50%',
          background: 'var(--color-brand-600)', opacity: 0.06,
          pointerEvents: 'none',
        }} />
        <div style={{
          position: 'absolute', bottom: -80, left: -80,
          width: 300, height: 300, borderRadius: '50%',
          background: 'var(--color-brand-800)', opacity: 0.05,
          pointerEvents: 'none',
        }} />

        {/* Card principal */}
        <div style={{
          width: '100%', maxWidth: 400,
          background: 'var(--color-bg-default)',
          borderRadius: 'var(--radius-2xl)',
          boxShadow: 'var(--shadow-xl)',
          border: '1px solid var(--color-border-muted)',
          overflow: 'hidden',
          position: 'relative', zIndex: 1,
        }}>

          {/* Header — gradiente brand */}
          <div style={{
            background: 'linear-gradient(135deg, var(--color-brand-600), var(--color-brand-800))',
            padding: '28px 32px',
            position: 'relative',
            overflow: 'hidden',
          }}>
            {/* Detalhe geométrico interno */}
            <div style={{
              position: 'absolute', top: -30, right: -30,
              width: 120, height: 120, borderRadius: '50%',
              background: 'rgba(255,255,255,0.06)',
              pointerEvents: 'none',
            }} />
            <div style={{
              display: 'flex', alignItems: 'center', gap: 12,
              position: 'relative',
            }}>
              <Box size={28} color="var(--color-text-inverse)" strokeWidth={1.75} />
              <div>
                <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--color-text-inverse)', lineHeight: 1.2 }}>
                  StockFlow
                </div>
                <div style={{ fontSize: 12, color: 'var(--color-brand-200)', marginTop: 2 }}>
                  Enterprise v2.0
                </div>
              </div>
            </div>
          </div>

          {/* Body */}
          <div style={{ padding: '28px 32px' }}>

            {/* Campo Código */}
            <div style={{ marginBottom: 20 }}>
              <label style={{
                fontSize: 11, fontWeight: 600, letterSpacing: '0.08em',
                textTransform: 'uppercase', color: 'var(--color-text-tertiary)',
                display: 'block', marginBottom: 6,
              }}>
                Código do Operador
              </label>

              {nomeUsuario && (
                <div style={{
                  fontSize: 20, fontWeight: 700, letterSpacing: '0.02em',
                  color: 'var(--color-text-primary)', marginBottom: 8,
                  textTransform: 'uppercase',
                  animation: 'fadeIn 0.2s ease',
                  lineHeight: 1.2,
                }}>
                  {nomeUsuario}
                </div>
              )}
              {!nomeUsuario && codigo && !buscandoUsuario && (
                <div style={{ fontSize: 13, color: 'var(--color-danger-600)', marginBottom: 8 }}>
                  Operador não encontrado
                </div>
              )}
              {buscandoUsuario && (
                <div style={{ fontSize: 13, color: 'var(--color-text-tertiary)', marginBottom: 8 }}>
                  Buscando…
                </div>
              )}

              <div style={{ position: 'relative' }}>
                <Hash size={16} style={{
                  position: 'absolute', left: 12, top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--color-text-tertiary)', pointerEvents: 'none',
                }} />
                <input
                  className="sf-code-input"
                  type="number"
                  min="1"
                  value={codigo}
                  onChange={e => { setCodigo(e.target.value); setErro('') }}
                  placeholder="Digite seu número"
                  autoFocus
                  style={{
                    border: `1px solid ${usuarioEncontrado
                      ? 'var(--color-success-600)'
                      : 'var(--color-border-default)'}`,
                  }}
                />
                {usuarioEncontrado && (
                  <CheckCircle size={16} style={{
                    position: 'absolute', right: 12, top: '50%',
                    transform: 'translateY(-50%)',
                    color: 'var(--color-success-600)',
                    pointerEvents: 'none',
                  }} />
                )}
              </div>
            </div>

            {/* Campo Senha */}
            <div style={{
              marginBottom: 20,
              opacity: usuarioEncontrado ? 1 : 0.45,
              transition: 'opacity 0.3s',
            }}>
              <label style={{
                fontSize: 11, fontWeight: 600, letterSpacing: '0.08em',
                textTransform: 'uppercase', color: 'var(--color-text-tertiary)',
                display: 'block', marginBottom: 6,
              }}>
                Senha
              </label>
              <div style={{ position: 'relative' }}>
                <Lock size={16} style={{
                  position: 'absolute', left: 12, top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--color-text-tertiary)', pointerEvents: 'none',
                }} />
                <input
                  id="campo-senha"
                  className="sf-senha-input"
                  type={showSenha ? 'text' : 'password'}
                  value={senha}
                  onChange={e => { setSenha(e.target.value); setErro('') }}
                  placeholder="••••••••"
                  disabled={!usuarioEncontrado}
                  autoComplete="current-password"
                  style={{
                    border: '1px solid var(--color-border-default)',
                    background: usuarioEncontrado
                      ? 'var(--color-bg-default)'
                      : 'var(--color-bg-subtle)',
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowSenha(s => !s)}
                  disabled={!usuarioEncontrado}
                  style={{
                    position: 'absolute', right: 10, top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none', border: 'none',
                    cursor: usuarioEncontrado ? 'pointer' : 'default',
                    color: 'var(--color-text-tertiary)', padding: 4,
                    display: 'flex', alignItems: 'center',
                  }}
                  aria-label={showSenha ? 'Ocultar senha' : 'Mostrar senha'}
                >
                  {showSenha ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Erro */}
            {erro && (
              <div style={{
                background: 'var(--color-danger-50)',
                border: '1px solid var(--color-danger-200)',
                borderRadius: 'var(--radius-md)',
                padding: '8px 12px', marginBottom: 16,
                fontSize: 13, color: 'var(--color-danger-600)',
              }}>
                {erro}
              </div>
            )}

            {/* Botão */}
            <button
              type="submit"
              disabled={loading || !usuarioEncontrado}
              className="sf-submit-btn"
              style={{
                background: usuarioEncontrado
                  ? 'linear-gradient(135deg, var(--color-brand-600), var(--color-brand-800))'
                  : 'var(--color-bg-muted)',
                color: usuarioEncontrado
                  ? 'var(--color-text-inverse)'
                  : 'var(--color-text-tertiary)',
                cursor: usuarioEncontrado && !loading ? 'pointer' : 'not-allowed',
              }}
            >
              {loading ? (
                <div style={{
                  width: 18, height: 18, borderRadius: '50%',
                  border: '2px solid rgba(255,255,255,0.3)',
                  borderTopColor: 'var(--color-text-inverse)',
                  animation: 'spin 0.8s linear infinite',
                }} />
              ) : (
                <><LogIn size={16} /> Entrar</>
              )}
            </button>

          </div>

          {/* Rodapé */}
          <div style={{
            padding: '14px 32px',
            borderTop: '1px solid var(--color-border-muted)',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 6,
              fontSize: 12, color: 'var(--color-text-tertiary)',
            }}>
              <span style={{
                width: 7, height: 7, borderRadius: '50%',
                background: 'var(--color-success-600)',
                display: 'inline-block',
                boxShadow: '0 0 0 2px var(--color-pulse-success-start)',
              }} />
              Sistema online
            </div>
            <span style={{
              fontSize: 11, color: 'var(--color-text-tertiary)',
              background: 'var(--color-bg-subtle)',
              border: '1px solid var(--color-border-muted)',
              borderRadius: 'var(--radius-sm)', padding: '2px 8px',
              fontFamily: 'var(--font-data)',
            }}>
              v1.3.0
            </span>
          </div>

        </div>
      </div>
    </form>
  )
}
