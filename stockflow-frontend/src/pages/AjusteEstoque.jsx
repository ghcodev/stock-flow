import { useState, useEffect } from 'react'
import Layout from '../components/Layout.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { useToast } from '../context/ToastContext.jsx'
import api from '../api/axios.js'
import {
  ShieldOff, Search, ArrowRight, FileText, CheckCircle,
  Sliders, SlidersHorizontal, Shield, Layers,
} from 'lucide-react'

/* ─── Access denied (unchanged) ───────────────────────────── */
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

/* ─── KPI card ─────────────────────────────────────────────── */
function AjeKpiCard({ icon: Icon, label, value, valueStyle }) {
  return (
    <div className="aje-kpi-card">
      <div className="aje-kpi-icon"><Icon size={16} /></div>
      <div style={{ minWidth: 0 }}>
        <div className="aje-kpi-label">{label}</div>
        <div className="aje-kpi-value" style={valueStyle}>{value}</div>
      </div>
    </div>
  )
}

/* ─── Main component ───────────────────────────────────────── */
export default function AjusteEstoque() {
  const { user }  = useAuth()
  const toast     = useToast()

  const [lotes,           setLotes]           = useState([])
  const [search,          setSearch]          = useState('')
  const [selected,        setSelected]        = useState(null)
  const [novaQty,         setNovaQty]         = useState('')
  const [justificativa,   setJustificativa]   = useState('')
  const [submitted,       setSubmitted]       = useState(false)
  const [submitting,      setSubmitting]      = useState(false)
  const [loadingLotes,    setLoadingLotes]    = useState(true)
  const [ajustesSessao,   setAjustesSessao]   = useState(0)
  const [historicoSessao, setHistoricoSessao] = useState([])

  useEffect(() => {
    if (!user?.isAdmin) return
    const t = setTimeout(() => loadLotes(), 300)
    return () => clearTimeout(t)
  }, [search, user?.isAdmin])

  if (!user?.isAdmin) return <AcessoNegado />

  /* ── API (unchanged) ────────────────────────────────────── */
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

  /* ── Computed ────────────────────────────────────────────── */
  function fmtLoc(l) {
    if (l.corredor && l.nivel && l.posicao) return `${l.corredor}-N${l.nivel}-P${l.posicao}`
    return l.localizacao || '—'
  }

  const filteredLotes = lotes.filter(l =>
    !search.trim() ||
    (l.codigo || '').toLowerCase().includes(search.toLowerCase()) ||
    (l.produto_nome || '').toLowerCase().includes(search.toLowerCase()) ||
    fmtLoc(l).toLowerCase().includes(search.toLowerCase()) ||
    String(l.id || '').toLowerCase().includes(search.toLowerCase())
  )

  const delta       = selected && novaQty !== '' ? parseInt(novaQty) - (selected.quantidade ?? 0) : null
  const justValida  = justificativa.trim().length >= 10
  const canSubmit   = selected && novaQty !== '' && parseInt(novaQty) >= 0 && justValida && !submitting && delta !== 0

  /* ── Submit (preserve logic, add session tracking) ─────── */
  async function handleSubmit(e) {
    e.preventDefault()
    if (!canSubmit) return
    setSubmitting(true)
    const snap = { ...selected }
    const snapNovaQty = novaQty
    const snapDelta   = delta
    try {
      const res = await api.post('/movimentacoes/ajuste', {
        id_lote:         selected.id,
        nova_quantidade: parseInt(novaQty),
        justificativa,
      })
      toast.success(res.data?.mensagem || 'Ajuste registrado com sucesso!')
      setSubmitted(true)
      setAjustesSessao(prev => prev + 1)
      setHistoricoSessao(prev => [{
        codigo:    snap.codigo || snap.id,
        qtyAntes:  snap.quantidade ?? 0,
        qtyDepois: parseInt(snapNovaQty),
        delta:     snapDelta,
        hora:      new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
        just:      justificativa.trim().slice(0, 55),
      }, ...prev].slice(0, 5))
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

  /* ── Render ──────────────────────────────────────────────── */
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

      {/* KPI Strip */}
      <div className="aje-kpi-grid">
        <AjeKpiCard icon={Layers}       label="Lotes Disponíveis"  value={lotes.length} />
        <AjeKpiCard
          icon={Sliders}
          label="Lote Selecionado"
          value={selected ? (selected.codigo || selected.id) : '—'}
          valueStyle={selected ? { fontSize: 15, lineHeight: 1.3, fontWeight: 800, fontFamily: '"IBM Plex Mono",monospace', color: 'var(--color-brand-700)' } : undefined}
        />
        <AjeKpiCard icon={FileText}    label="Quantidade Atual"   value={selected ? (selected.quantidade ?? '—') : '—'} />
        <AjeKpiCard icon={CheckCircle} label="Ajustes na Sessão"  value={ajustesSessao} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>

        {/* ─── Left — lote selector ─────────────────────── */}
        <div>
          <div className="card">
            <div className="card-header"><span className="card-title">Selecionar lote</span></div>

            <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--color-border-default)' }}>
              <div style={{ position: 'relative' }}>
                <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-tertiary)', pointerEvents: 'none' }} />
                <input
                  className="input"
                  style={{ paddingLeft: 32 }}
                  placeholder="Buscar por lote, produto ou localização…"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
              </div>
              <div style={{ marginTop: 6, fontSize: 11, color: 'var(--color-text-tertiary)' }}>
                {loadingLotes ? 'Carregando…' : `${filteredLotes.length} lotes encontrados`}
              </div>
            </div>

            <div style={{ maxHeight: 520, overflowY: 'auto' }}>
              {loadingLotes ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} style={{ padding: '12px 16px', borderBottom: '1px solid var(--color-border-muted)' }}>
                    <div style={{ height: 11, width: '60%', background: 'var(--color-bg-muted)', borderRadius: 4, marginBottom: 6, animation: 'aje-shimmer 1.2s ease-in-out infinite' }} />
                    <div style={{ height: 13, width: '80%', background: 'var(--color-bg-muted)', borderRadius: 4, animation: 'aje-shimmer 1.2s ease-in-out infinite' }} />
                  </div>
                ))
              ) : filteredLotes.length === 0 ? (
                <div style={{ padding: 24, textAlign: 'center', color: 'var(--color-text-tertiary)', fontSize: 13 }}>
                  Nenhum lote encontrado.
                </div>
              ) : filteredLotes.map((l, i) => {
                const isSelected = selected?.id === l.id
                const qty        = l.quantidade ?? 0
                const isZerado   = qty === 0
                const isCritico  = qty > 0 && qty <= 10

                return (
                  <button
                    key={l.id}
                    type="button"
                    onClick={() => { setSelected(l); setNovaQty(''); setJustificativa('') }}
                    style={{
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      padding: '12px 16px',
                      borderBottom: i < filteredLotes.length - 1 ? '1px solid var(--color-border-muted)' : 'none',
                      background: isSelected ? 'var(--color-brand-50)' : 'transparent',
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'background 80ms',
                      borderLeft: isSelected ? '3px solid var(--color-brand-600)' : '3px solid transparent',
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontFamily: '"IBM Plex Mono",monospace', fontSize: 11, fontWeight: 600, color: 'var(--color-brand-700)' }}>
                        {l.codigo || l.id}
                      </div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 2 }}>
                        {l.produto_nome || '—'}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--color-text-tertiary)' }}>{fmtLoc(l)}</div>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: 16, fontVariantNumeric: 'tabular-nums' }}>{qty}</div>
                      <div style={{ fontSize: 10, color: 'var(--color-text-tertiary)', marginBottom: 4 }}>unid. atual</div>
                      {isZerado  && <span className="badge badge-danger"  style={{ fontSize: 9, padding: '1px 5px' }}>Zerado</span>}
                      {isCritico && <span className="badge badge-warning" style={{ fontSize: 9, padding: '1px 5px' }}>Crítico</span>}
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        {/* ─── Right — adjustment panel ─────────────────── */}
        <div>
          {!selected ? (
            <div className="card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 48, gap: 12, textAlign: 'center', height: '100%', minHeight: 300 }}>
              <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'var(--color-bg-muted)', display: 'grid', placeItems: 'center', color: 'var(--color-text-tertiary)' }}>
                <SlidersHorizontal size={22} />
              </div>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-text-secondary)' }}>Selecione um lote para ajustar</div>
              <div style={{ fontSize: 13, color: 'var(--color-text-tertiary)' }}>Clique em qualquer lote na lista à esquerda</div>
            </div>
          ) : (
            <form onSubmit={handleSubmit}>

              {/* Lote info section */}
              <div style={{ background: 'var(--color-bg-muted)', border: '1px solid var(--color-border-default)', borderRadius: 'var(--radius-lg)', padding: '16px 20px', marginBottom: 16 }}>
                <div style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--color-text-tertiary)', marginBottom: 10 }}>Lote selecionado</div>
                <div style={{ fontFamily: '"IBM Plex Mono",monospace', fontSize: 20, fontWeight: 700, color: 'var(--color-brand-700)', marginBottom: 2 }}>
                  {selected.codigo || selected.id}
                </div>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-text-primary)', marginBottom: 2 }}>{selected.produto_nome || '—'}</div>
                <div style={{ fontSize: 12, color: 'var(--color-text-tertiary)', fontFamily: '"IBM Plex Mono",monospace', marginBottom: 10 }}>{fmtLoc(selected)}</div>
                {selected.data_validade && (
                  <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginBottom: 10 }}>
                    Validade: {new Date(selected.data_validade).toLocaleDateString('pt-BR')}
                  </div>
                )}
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                  <span style={{ fontSize: 36, fontWeight: 800, color: 'var(--color-text-primary)', fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>
                    {selected.quantidade ?? '—'}
                  </span>
                  <span style={{ fontSize: 12, color: 'var(--color-text-tertiary)' }}>unidades atuais</span>
                </div>
              </div>

              {/* Adjustment form */}
              <div className="card" style={{ marginBottom: 16 }}>
                <div className="card-header"><span className="card-title">Novo valor</span></div>
                <div style={{ padding: 20 }}>

                  <div className="form-group">
                    <label className="form-label">Nova quantidade *</label>
                    <input
                      className="input"
                      type="number"
                      min="0"
                      placeholder="0"
                      value={novaQty}
                      onChange={e => setNovaQty(e.target.value)}
                      style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums', fontSize: 18 }}
                    />
                    {/* Inline diff text */}
                    {novaQty !== '' && delta !== null && (
                      <div style={{ marginTop: 6, fontSize: 12, fontWeight: 700,
                        color: delta === 0 ? 'var(--color-text-tertiary)' : delta > 0 ? 'var(--color-success-700)' : 'var(--color-danger-700)' }}>
                        {delta === 0 ? 'Sem alteração'
                          : delta > 0 ? `+${delta} unidades (acréscimo)`
                          : `${delta} unidades (redução)`}
                      </div>
                    )}
                  </div>

                  {/* Visual diff display (preserved, excellent) */}
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
                      <span style={{ fontSize: 11, color: justificativa.trim().length < 10 ? 'var(--color-danger-600)' : 'var(--color-success-600)', marginLeft: 8 }}>
                        ({justificativa.trim().length}/10 mín.)
                      </span>
                    </label>
                    <textarea
                      className="textarea"
                      placeholder="Descreva o motivo do ajuste com detalhes suficientes para a auditoria…"
                      value={justificativa}
                      onChange={e => setJustificativa(e.target.value)}
                      style={{ minHeight: 90 }}
                    />
                  </div>

                  {/* Audit warning (Shield icon) */}
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '12px 14px', background: 'var(--color-warning-50)', border: '1px solid var(--color-warning-200)', borderRadius: 8, fontSize: 12, color: 'var(--color-warning-700)', lineHeight: 1.5 }}>
                    <Shield size={14} style={{ flexShrink: 0, marginTop: 1 }} />
                    <span>
                      Este ajuste será registrado em <strong>AUDITORIA_LOG</strong> com seu usuário, timestamp e justificativa. Ação irreversível.
                    </span>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button type="button" className="btn btn-outline" onClick={() => setSelected(null)}>Cancelar</button>
                <button type="submit" className="btn btn-primary" disabled={!canSubmit}>
                  {submitting
                    ? <><span style={{ width: 13, height: 13, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'var(--color-text-inverse)', borderRadius: '50%', animation: 'aje-spin 0.65s linear infinite', display: 'inline-block' }} /> Aplicando…</>
                    : submitted
                      ? <><CheckCircle size={14} /> Ajuste registrado!</>
                      : <><FileText size={14} /> Aplicar ajuste</>
                  }
                </button>
              </div>
            </form>
          )}

          {/* Session history */}
          {historicoSessao.length > 0 && (
            <div className="card" style={{ marginTop: 16, padding: '14px 20px' }}>
              <div style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--color-text-tertiary)', marginBottom: 10 }}>
                Ajustes realizados nesta sessão
              </div>
              {historicoSessao.map((h, i) => (
                <div
                  key={i}
                  style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0', borderBottom: i < historicoSessao.length - 1 ? '1px solid var(--color-border-muted)' : 'none', fontSize: 12 }}
                >
                  <span style={{ fontFamily: '"IBM Plex Mono",monospace', color: 'var(--color-brand-700)', fontWeight: 600, flexShrink: 0 }}>{h.codigo}</span>
                  <span style={{ color: 'var(--color-text-tertiary)' }}>→</span>
                  <span style={{ fontWeight: 700, color: h.delta > 0 ? 'var(--color-success-700)' : 'var(--color-danger-700)', fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>
                    {h.qtyAntes} → {h.qtyDepois}
                  </span>
                  <span style={{ color: 'var(--color-text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                    · {h.just}
                  </span>
                  <span style={{ color: 'var(--color-text-tertiary)', flexShrink: 0, fontFamily: '"IBM Plex Mono",monospace', fontSize: 11 }}>{h.hora}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes aje-shimmer { 0%,100%{opacity:1} 50%{opacity:0.5} }
        @keyframes aje-spin    { to{transform:rotate(360deg)} }

        .aje-kpi-grid { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:12px; margin-bottom:20px }
        .aje-kpi-card { display:flex; align-items:center; gap:12px; min-height:74px; padding:12px 14px; background:var(--color-bg-default); border:1px solid var(--color-border-default); border-radius:var(--radius-md); box-shadow:var(--shadow-xs) }
        .aje-kpi-icon { width:30px; height:30px; display:grid; place-items:center; background:var(--color-bg-subtle); border:1px solid var(--color-border-muted); border-radius:var(--radius-sm); flex-shrink:0; color:var(--color-text-secondary) }
        .aje-kpi-label { font-size:10px; font-weight:700; color:var(--color-text-tertiary); text-transform:uppercase; letter-spacing:0.08em }
        .aje-kpi-value { margin-top:2px; font-size:26px; line-height:1; font-weight:800; color:var(--color-text-primary); font-variant-numeric:tabular-nums }

        @media(max-width:1180px) { .aje-kpi-grid{grid-template-columns:repeat(2,minmax(0,1fr))} }
        @media(max-width:700px)  { .aje-kpi-grid{grid-template-columns:1fr} }
      `}</style>
    </Layout>
  )
}
