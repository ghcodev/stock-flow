import { useState, useEffect, useRef } from 'react'
import { useNavigate, Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import api from '../api/axios.js'
import { Box, Lock, Eye, EyeOff, Hash, CheckCircle, LogIn } from 'lucide-react'

export default function Login() {
  const { login, user } = useAuth()
  const navigate = useNavigate()

  const [codigo, setCodigo]                   = useState('1')
  const [nomeUsuario, setNomeUsuario]         = useState('')
  const [buscandoUsuario, setBuscandoUsuario] = useState(false)
  const [usuarioEncontrado, setUsuarioEncontrado] = useState(false)
  const [senha, setSenha]     = useState('admin123')
  const [erro, setErro]       = useState('')
  const [loading, setLoading] = useState(false)
  const [showSenha, setShowSenha] = useState(false)
  const canvasRef = useRef(null)

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
        const res = await api.get(`/usuarios/codigo/${codigo}`)
        if (res.data?.id) {
          setNomeUsuario(res.data.nome)
          setUsuarioEncontrado(true)
          setErro('')
          document.getElementById('campo-senha')?.focus()
        } else {
          setNomeUsuario('')
          setUsuarioEncontrado(false)
        }
      } catch {
        setNomeUsuario('')
        setUsuarioEncontrado(false)
      } finally {
        setBuscandoUsuario(false)
      }
    }, 600)
    return () => clearTimeout(timer)
  }, [codigo])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return undefined
    const ctx = canvas.getContext('2d')
    let frame = 0
    let width = 0
    let height = 0
    const particles = Array.from({ length: 40 }, () => ({
      x: Math.random(),
      y: Math.random(),
      vx: (Math.random() - 0.5) * 0.35,
      vy: (Math.random() - 0.5) * 0.35,
    }))

    function resize() {
      const dpr = window.devicePixelRatio || 1
      width = window.innerWidth
      height = window.innerHeight
      canvas.width = Math.floor(width * dpr)
      canvas.height = Math.floor(height * dpr)
      canvas.style.width = `${width}px`
      canvas.style.height = `${height}px`
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }

    function draw() {
      ctx.clearRect(0, 0, width, height)
      particles.forEach(p => {
        p.x += p.vx
        p.y += p.vy
        if (p.x <= 0 || p.x >= width) p.vx *= -1
        if (p.y <= 0 || p.y >= height) p.vy *= -1
      })

      for (let i = 0; i < particles.length; i += 1) {
        const a = particles[i]
        for (let j = i + 1; j < particles.length; j += 1) {
          const b = particles[j]
          const dist = Math.hypot(a.x - b.x, a.y - b.y)
          if (dist < 120) {
            ctx.strokeStyle = `rgba(46,117,182,${0.16 * (1 - dist / 120)})`
            ctx.lineWidth = 1
            ctx.beginPath()
            ctx.moveTo(a.x, a.y)
            ctx.lineTo(b.x, b.y)
            ctx.stroke()
          }
        }
      }

      particles.forEach(p => {
        ctx.fillStyle = 'rgba(46,117,182,0.4)'
        ctx.beginPath()
        ctx.arc(p.x, p.y, 2, 0, Math.PI * 2)
        ctx.fill()
      })
      frame = requestAnimationFrame(draw)
    }

    resize()
    particles.forEach(p => {
      p.x *= width
      p.y *= height
    })
    window.addEventListener('resize', resize)
    frame = requestAnimationFrame(draw)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('resize', resize)
    }
  }, [])

  if (user) return <Navigate to="/dashboard" replace />

  function triggerInputError(id) {
    const el = document.getElementById(id)
    if (el) {
      el.classList.add('input-error')
      setTimeout(() => el.classList.remove('input-error'), 400)
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!usuarioEncontrado) {
      setErro('Digite um codigo de operador valido')
      triggerInputError('campo-codigo')
      return
    }
    if (!senha) {
      setErro('Digite sua senha')
      triggerInputError('campo-senha')
      return
    }
    setLoading(true)
    setErro('')
    try {
      await login(codigo, senha)
      navigate('/dashboard')
    } catch (err) {
      setErro(err.response?.data?.error || 'Codigo ou senha incorretos')
      triggerInputError('campo-codigo')
      triggerInputError('campo-senha')
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
        <canvas
          ref={canvasRef}
          aria-hidden="true"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 0,
            pointerEvents: 'none',
          }}
        />

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
          .sf-code-input::placeholder { color: transparent; }
          .sf-code-input:focus::placeholder { color: var(--color-text-tertiary); }

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

        {/* PadrÃ£o de grid SVG */}
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

        {/* CÃ­rculos decorativos brand */}
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

          {/* Header â€” gradiente brand */}
          <div style={{
            background: 'linear-gradient(135deg, var(--color-brand-600), var(--color-brand-800))',
            padding: '28px 32px',
            position: 'relative',
            overflow: 'hidden',
          }}>
            {/* Detalhe geomÃ©trico interno */}
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

            {/* Campo CÃ³digo */}
            <div style={{ marginBottom: 20 }}>

              {nomeUsuario && (
                <div style={{
                  fontSize: 14, fontWeight: 700,
                  color: 'var(--color-success-700)', marginBottom: 8,
                  animation: 'fadeIn 0.2s ease',
                  lineHeight: 1.2,
                }}>
                  Ola, {nomeUsuario}
                </div>
              )}
              {!nomeUsuario && codigo && !buscandoUsuario && (
                <div style={{ fontSize: 13, color: 'var(--color-danger-600)', marginBottom: 8 }}>
                  Operador nao encontrado
                </div>
              )}
              {buscandoUsuario && (
                <div style={{ fontSize: 13, color: 'var(--color-text-tertiary)', marginBottom: 8 }}>
                  Buscando...
                </div>
              )}

              <div className="input-float has-icon">
                <Hash size={16} style={{
                  position: 'absolute', left: 12, top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--color-text-tertiary)', pointerEvents: 'none',
                }} />
                <input
                  id="campo-codigo"
                  className="sf-code-input"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={codigo}
                  onChange={e => { setCodigo(e.target.value); setErro('') }}
                  placeholder="Digite seu codigo"
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
                <label>Codigo do Operador</label>
              </div>
            </div>

            {/* Campo Senha */}
            <div style={{
              marginBottom: 20,
              opacity: usuarioEncontrado ? 1 : 0.45,
              transition: 'opacity 0.3s',
            }}>
              <div className="input-float has-icon has-action">
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
                  placeholder=" "
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
                <label>Senha</label>
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

            {/* BotÃ£o */}
            <button
              type="submit"
              disabled={loading || !usuarioEncontrado || !senha}
              className={`sf-submit-btn ${loading ? 'btn-loading' : ''}`}
              style={{
                background: usuarioEncontrado && senha
                  ? 'linear-gradient(135deg, var(--color-brand-600), var(--color-brand-800))'
                  : 'var(--color-bg-muted)',
                color: usuarioEncontrado && senha
                  ? 'var(--color-text-inverse)'
                  : 'var(--color-text-tertiary)',
                cursor: usuarioEncontrado && senha && !loading ? 'pointer' : 'not-allowed',
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

          {/* RodapÃ© */}
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


