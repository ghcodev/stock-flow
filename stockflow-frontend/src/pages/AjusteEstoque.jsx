import { useState, useEffect } from 'react'
import Layout from '../components/Layout.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { useToast } from '../context/ToastContext.jsx'
import api from '../api/axios.js'
import { ShieldOff, Search, ArrowRight, AlertTriangle, FileText, CheckCircle, Sliders } from 'lucide-react'

function AcessoNegado() {
  return (
    <Layout breadcrumb={['Administração', 'Ajuste de Estoque']}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '80px 24px', gap: 16, textAlign: 'center' }}>
        <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'var(--color-danger-100)', display: 'grid', placeItems: 'center', color: 'var(--color-danger-600)' }}>
          <ShieldOff size={32} />
        </div>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--color-text-primary)' }}>Acesso restrito</h2>
        <p style={{ fontSize: 14, color: 'var(--color-text-secondary)', maxWidth: 380, lineHeight: 1.6 }}>
          O ajuste de estoque é uma operação sensível disponível apenas para <strong>Administradores</strong>. Qualquer alteração é registrada imediatamente no log de auditoria imutável.
        </p>
        <span className="badge badge-danger" style={{ fontSize: 13, padding: '6px 14px' }}>
          <ShieldOff size={12} /> Perfil Operador não autorizado
        </span>
      </div>
    </Layout>
  )
}

export default function AjusteEstoque() {
  const { user } = useAuth()
  const toast = useToast()
  const [lotes, setLotes] = useState([])
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState(null)
  const [novaQty, setNovaQty] = useState('')
  const [justificativa, setJustificativa] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [loadingLotes, setLoadingLotes] = useState(true)

  useEffect(() => {
    if (!user?.isAdmin) return
    const t = setTimeout(() => loadLotes(), 300)
    return () => clearTimeout(t)
  }, [search, user?.isAdmin])

  if (!user?.isAdmin) return <AcessoNegado />

  async function loadLotes() {
    setLoadingLotes(true)
    try {
      const { data } = await api.get('/lotes', { params: { search, limit: 50 } })
      setLotes(data.data || [])
    } catch {
      toast.error('Erro ao carregar lotes.')
    } finally {
      setLoadingLotes(false)
    }
  }

  const delta = selected && novaQty !== '' ? parseInt(novaQty) - (selected.quantidade ?? 0) : null
  const justValida = justificativa.trim().length >= 10
  const canSubmit = selected && novaQty !== '' && parseInt(novaQty) >= 0 && justValida && !submitting

  async function handleSubmit(e) {
    e.preventDefault()
    if (!canSubmit) return
    setSubmitting(true)
    try {
      const res = await api.post('/movimentacoes/ajuste', {
        id_lote: selected.id,
        nova_quantidade: parseInt(novaQty),
        justificativa,
      })
      toast.success(res.data?.mensagem || 'Ajuste registrado com sucesso!')
      setSubmitted(true)
      setTimeout(() => {
        setSubmitted(false)
        setSelected(null)
        setNovaQty('')
        setJustificativa('')
        loadLotes()
      }, 2500)
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erro ao aplicar ajuste.')
    } finally {
      setSubmitting(false)
    }
  }

  function fmtLoc(l) {
    if (l.corredor && l.nivel && l.posicao) return `${l.corredor}-N${l.nivel}-P${l.posicao}`
    return l.localizacao || '—'
  }

  return (
    <Layout breadcrumb={['Administração', 'Ajuste de Estoque']}>
      <div className="page-header">
        <div className="page-header-left">
          <h1>Ajuste de Estoque</h1>
          <div className="subtitle">
            <span style={{ background: 'var(--color-admin-100)', color: 'var(--color-admin-700)', padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 700 }}>Somente Admin</span>
            <span className="sep" />
            <span>Toda alteração é registrada em AUDITORIA_LOG</span>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        {/* Left — lot selector */}
        <div>
          <div className="card">
            <div className="card-header"><span className="card-title">Selecionar lote</span></div>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--color-border-default)' }}>
              <div style={{ position: 'relative' }}>
                <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-tertiary)' }} />
                <input
                  className="input"
                  style={{ paddingLeft: 32 }}
                  placeholder="Buscar por lote ou produto…"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
              </div>
            </div>
            <div>
              {loadingLotes ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} style={{ padding: '12px 16px', borderBottom: '1px solid var(--color-border-muted)' }}>
                    <div style={{ height: 11, width: '60%', background: 'var(--color-bg-muted)', borderRadius: 4, marginBottom: 6, animation: 'shimmer 1.2s ease-in-out infinite' }} />
                    <div style={{ height: 13, width: '80%', background: 'var(--color-bg-muted)', borderRadius: 4, animation: 'shimmer 1.2s ease-in-out infinite' }} />
                  </div>
                ))
              ) : lotes.length === 0 ? (
                <div style={{ padding: '24px', textAlign: 'center', color: 'var(--color-text-tertiary)', fontSize: 13 }}>Nenhum lote encontrado.</div>
              ) : lotes.map((l, i) => (
                <button
                  key={l.id}
                  onClick={() => { setSelected(l); setNovaQty(''); setJustificativa('') }}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px',
                    borderBottom: i < lotes.length - 1 ? '1px solid var(--color-border-muted)' : 'none',
                    background: selected?.id === l.id ? 'var(--color-brand-50)' : 'none',
                    border: 'none', cursor: 'pointer', textAlign: 'left',
                    borderLeft: selected?.id === l.id ? '3px solid var(--color-brand-600)' : '3px solid transparent',
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: '"IBM Plex Mono",monospace', fontSize: 11, fontWeight: 600, color: 'var(--color-brand-700)' }}>{l.codigo || l.id}</div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 2 }}>{l.produto_nome || '—'}</div>
                    <div style={{ fontSize: 11, color: 'var(--color-text-tertiary)' }}>{fmtLoc(l)}</div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 16, fontVariantNumeric: 'tabular-nums' }}>{l.quantidade ?? '—'}</div>
                    <div style={{ fontSize: 10, color: 'var(--color-text-tertiary)' }}>unid. atual</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right — adjustment form */}
        <div>
          {!selected ? (
            <div className="card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 48, gap: 12, textAlign: 'center', height: '100%', minHeight: 300 }}>
              <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'var(--color-bg-muted)', display: 'grid', placeItems: 'center', color: 'var(--color-text-tertiary)' }}>
                <Sliders size={22} />
              </div>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text-secondary)' }}>Selecione um lote</div>
              <div style={{ fontSize: 13, color: 'var(--color-text-tertiary)' }}>Escolha um lote à esquerda para ajustar a quantidade.</div>
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              <div className="card" style={{ marginBottom: 16 }}>
                <div className="card-header">
                  <span className="card-title">Ajuste — {selected.codigo || selected.id}</span>
                </div>
                <div style={{ padding: 20 }}>
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-tertiary)', marginBottom: 4 }}>Produto</div>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{selected.produto_nome || '—'}</div>
                    <div style={{ fontSize: 12, color: 'var(--color-text-tertiary)', fontFamily: '"IBM Plex Mono",monospace' }}>{fmtLoc(selected)}</div>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Quantidade atual (somente leitura)</label>
                    <input className="input" value={selected.quantidade ?? '—'} readOnly style={{ background: 'var(--color-bg-subtle)', color: 'var(--color-text-secondary)', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }} />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Nova quantidade *</label>
                    <input className="input" type="number" min="0" placeholder="0" value={novaQty}
                      onChange={e => setNovaQty(e.target.value)}
                      style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums', fontSize: 16 }} />
                  </div>

                  {novaQty !== '' && delta !== null && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', background: delta === 0 ? 'var(--color-bg-subtle)' : delta > 0 ? 'var(--color-success-50)' : 'var(--color-danger-50)', borderRadius: 8, border: `1px solid ${delta === 0 ? 'var(--color-border-default)' : delta > 0 ? 'var(--color-success-200)' : 'var(--color-danger-200)'}`, marginBottom: 16 }}>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-text-tertiary)', marginBottom: 4 }}>Antes</div>
                        <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--color-text-secondary)', fontVariantNumeric: 'tabular-nums' }}>{selected.quantidade ?? 0}</div>
                      </div>
                      <ArrowRight size={20} style={{ color: 'var(--color-text-tertiary)', flexShrink: 0 }} />
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-text-tertiary)', marginBottom: 4 }}>Depois</div>
                        <div style={{ fontSize: 22, fontWeight: 800, color: delta > 0 ? 'var(--color-success-600)' : delta < 0 ? 'var(--color-danger-600)' : 'var(--color-text-primary)', fontVariantNumeric: 'tabular-nums' }}>{parseInt(novaQty) || 0}</div>
                      </div>
                      {delta !== 0 && (
                        <>
                          <div style={{ width: 1, height: 40, background: delta > 0 ? 'var(--color-success-200)' : 'var(--color-danger-200)' }} />
                          <div style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-text-tertiary)', marginBottom: 4 }}>Diferença</div>
                            <div style={{ fontSize: 18, fontWeight: 800, color: delta > 0 ? 'var(--color-success-600)' : 'var(--color-danger-600)', fontVariantNumeric: 'tabular-nums' }}>
                              {delta > 0 ? '+' : ''}{delta}
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  )}

                  <div className="form-group">
                    <label className="form-label">
                      Justificativa obrigatória *
                      <span style={{ fontSize: 11, color: justificativa.length < 10 ? 'var(--color-danger-600)' : 'var(--color-success-600)', marginLeft: 8 }}>
                        ({justificativa.trim().length}/10 mín.)
                      </span>
                    </label>
                    <textarea className="textarea" placeholder="Descreva o motivo do ajuste com detalhes suficientes para a auditoria…"
                      value={justificativa} onChange={e => setJustificativa(e.target.value)} style={{ minHeight: 90 }} />
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', background: 'var(--color-warning-50)', border: '1px solid var(--color-warning-200)', borderRadius: 8, marginBottom: 16, fontSize: 12, color: 'var(--color-warning-700)' }}>
                    <AlertTriangle size={14} style={{ flexShrink: 0 }} />
                    Esta operação será registrada imediatamente em <strong style={{ marginLeft: 3 }}>AUDITORIA_LOG</strong> com hash SHA-256 imutável.
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button type="button" className="btn btn-outline" onClick={() => setSelected(null)}>Cancelar</button>
                <button type="submit" className="btn btn-primary" disabled={!canSubmit}>
                  {submitting
                    ? <><span style={{ width: 13, height: 13, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.65s linear infinite', display: 'inline-block' }} /> Aplicando…</>
                    : submitted
                      ? <><CheckCircle size={14} /> Ajuste registrado!</>
                      : <><FileText size={14} /> Aplicar ajuste</>
                  }
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
      <style>{`@keyframes shimmer{0%,100%{opacity:1}50%{opacity:0.5}} @keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </Layout>
  )
}
