import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import Layout from '../components/Layout.jsx'
import RFIDModal from '../components/RFIDModal.jsx'
import { useToast } from '../context/ToastContext.jsx'
import api from '../api/axios.js'
import {
  Search, ScanLine, ArrowDownLeft, ArrowUpRight, Shuffle,
  MapPin, Activity, Clock, X, ShieldCheck,
} from 'lucide-react'

/* ─── Config ───────────────────────────────────────────────── */
const TIPO_CFG = {
  entrada:       { icon: ArrowDownLeft, color: 'var(--color-success-600)', bg: 'var(--color-success-100)', label: 'Entrada'       },
  saida:         { icon: ArrowUpRight,  color: 'var(--color-danger-600)',  bg: 'var(--color-danger-100)',  label: 'Saída'         },
  transferencia: { icon: Shuffle,       color: 'var(--color-brand-600)',   bg: 'var(--color-brand-100)',   label: 'Transferência' },
  ajuste:        { icon: Activity,      color: 'var(--color-admin-600)',   bg: 'var(--color-admin-100)',   label: 'Ajuste'        },
}

const RECENT_INIT = ['AT-PAO-2026-001', 'AT-QUI-2026-004', 'AT-SAL-2026-008']

/* ─── Module-scope helpers ─────────────────────────────────── */
function statusCls(s) {
  const m = { ativo: 'badge-success', vencendo: 'badge-warning', vencido: 'badge-danger', bloqueado: 'badge-neutral' }
  return m[s?.toLowerCase()] || 'badge-neutral'
}

function statusColor(s) {
  return { ativo: 'var(--color-success-700)', vencendo: 'var(--color-warning-700)', vencido: 'var(--color-danger-700)', bloqueado: 'var(--color-text-secondary)' }[s?.toLowerCase()] || 'var(--color-text-primary)'
}

function validadeColor(lote) {
  if (!lote?.data_validade) return 'var(--color-text-primary)'
  const diff = lote.dias_para_vencer != null
    ? Number(lote.dias_para_vencer)
    : Math.floor((new Date(lote.data_validade) - Date.now()) / 86400000)
  if (diff < 0) return 'var(--color-danger-700)'
  if (diff <= 30) return 'var(--color-warning-700)'
  return 'var(--color-success-700)'
}

function fmtLoc(e) {
  if (e.tipo === 'transferencia') {
    const ori = e.localizacao_origem_nome || (e.origem_corredor ? `${e.origem_corredor}-N${e.origem_nivel}-P${e.origem_posicao}` : '?')
    const dst = e.localizacao_destino_nome || (e.destino_corredor ? `${e.destino_corredor}-N${e.destino_nivel}-P${e.destino_posicao}` : '?')
    return `${ori} → ${dst}`
  }
  if (e.corredor) return `${e.corredor}-N${e.nivel}-P${e.posicao}`
  return e.localizacao_nome || e.localizacao || '—'
}

function qtyLabel(e) {
  if (e.tipo === 'entrada') return `+${e.quantidade} un.`
  if (e.tipo === 'saida')   return `-${e.quantidade} un.`
  return `${e.quantidade} un.`
}

function qtyColor(e) {
  if (e.tipo === 'entrada') return 'var(--color-success-600)'
  if (e.tipo === 'saida')   return 'var(--color-danger-600)'
  return 'var(--color-text-secondary)'
}

function fmtDate(value) {
  return value ? new Date(value).toLocaleString('pt-BR') : '—'
}

function fmtDateShort(value) {
  return value ? new Date(value).toLocaleDateString('pt-BR') : '—'
}

function capitalize(s) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s
}

/* ─── Sub-components ───────────────────────────────────────── */
function RstKpiCard({ icon: Icon, label, value, valueColor }) {
  return (
    <div className="rst-kpi-card">
      <div className="rst-kpi-icon"><Icon size={16} /></div>
      <div>
        <div className="rst-kpi-label">{label}</div>
        <div className="rst-kpi-value" style={valueColor ? { color: valueColor } : undefined}>{value}</div>
      </div>
    </div>
  )
}

function CardSkeleton() {
  return (
    <div className="card" style={{ padding: 20 }}>
      {[75, 55, 35].map((w, i) => (
        <div key={i} className="skeleton" style={{ height: i === 0 ? 20 : 13, width: `${w}%`, marginBottom: i === 0 ? 12 : 8 }} />
      ))}
      <div className="skeleton" style={{ height: 22, width: 72, borderRadius: 999, marginBottom: 18 }} />
      <div style={{ borderTop: '1px solid var(--color-border-muted)', paddingTop: 12, display: 'flex', flexDirection: 'column', gap: 0 }}>
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--color-border-muted)' }}>
            <div className="skeleton" style={{ height: 11, width: '35%', borderRadius: 3 }} />
            <div className="skeleton" style={{ height: 11, width: '30%', borderRadius: 3 }} />
          </div>
        ))}
      </div>
    </div>
  )
}

function TimelineSkeleton({ count = 4 }) {
  return (
    <div>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} style={{ display: 'flex', gap: 14 }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
            <div className="skeleton" style={{ width: 36, height: 36, borderRadius: '50%', flexShrink: 0 }} />
            {i < count - 1 && <div style={{ width: 2, flex: 1, minHeight: 24, background: 'var(--color-bg-muted)', margin: '4px 0' }} />}
          </div>
          <div style={{ flex: 1, paddingBottom: 24, paddingTop: 6 }}>
            <div className="skeleton" style={{ height: 13, width: '55%', marginBottom: 8 }} />
            <div className="skeleton" style={{ height: 11, width: '38%', borderRadius: 3 }} />
          </div>
        </div>
      ))}
    </div>
  )
}

/* ─── Main component ───────────────────────────────────────── */
export default function Rastreabilidade() {
  const toast = useToast()
  const [searchParams] = useSearchParams()
  // Support both ?busca= (legacy) and ?lote= (links from other pages)
  const buscaParam = searchParams.get('busca') || searchParams.get('lote') || ''
  const ultimaBuscaUrlRef = useRef('')

  const [query,          setQuery]          = useState('')
  const [lote,           setLote]           = useState(null)
  const [timeline,       setTimeline]       = useState([])
  const [loading,        setLoading]        = useState(false)
  const [searched,       setSearched]       = useState(false)
  const [notFound,       setNotFound]       = useState(false)
  const [recentSearches, setRecentSearches] = useState(RECENT_INIT)
  const [rfidModalOpen,  setRfidModalOpen]  = useState(false)

  /* ── API ───────────────────────────────────────────────── */
  async function buscarTermo(termo) {
    const busca = termo.trim()
    if (!busca) return
    setLoading(true)
    setLote(null)
    setTimeline([])
    setNotFound(false)
    setSearched(true)
    try {
      const { data: lotesData } = await api.get('/lotes', { params: { search: busca, limit: 1 } })
      const items = lotesData.data || []
      if (items.length === 0) {
        setNotFound(true)
        return
      }
      const found = items[0]
      setLote(found)
      addToRecent(busca)
      const { data: tl } = await api.get(`/lotes/${found.id}/timeline`)
      setTimeline(tl || [])
    } catch {
      toast.error('Erro ao rastrear lote.')
    } finally {
      setLoading(false)
    }
  }

  function addToRecent(term) {
    setRecentSearches(prev => {
      const filtered = prev.filter(s => s !== term)
      return [term, ...filtered].slice(0, 3)
    })
  }

  function handleSearch(e) {
    e.preventDefault()
    buscarTermo(query)
  }

  function clearSearch() {
    setQuery('')
    setLote(null)
    setTimeline([])
    setSearched(false)
    setNotFound(false)
  }

  function handleRFIDConfirm(loteEncontrado) {
    const termo = loteEncontrado.numero_lote || loteEncontrado.codigo_lote || loteEncontrado.codigo || loteEncontrado.codigo_rfid || ''
    setRfidModalOpen(false)
    if (!termo) return
    setQuery(termo)
    buscarTermo(termo)
  }

  useEffect(() => {
    const termo = buscaParam.trim()
    if (!termo || ultimaBuscaUrlRef.current === termo) return
    ultimaBuscaUrlRef.current = termo
    setQuery(termo)
    buscarTermo(termo)
  }, [buscaParam])

  /* ── KPIs ────────────────────────────────────────────────── */
  const kpis = useMemo(() => {
    if (!lote) return { movs: '—', locs: '—', dias: '—', status: null }

    const locSet = new Set()
    timeline.forEach(e => {
      if (e.corredor)          locSet.add(`${e.corredor}-N${e.nivel}-P${e.posicao}`)
      if (e.origem_corredor)   locSet.add(`${e.origem_corredor}-N${e.origem_nivel}-P${e.origem_posicao}`)
      if (e.destino_corredor)  locSet.add(`${e.destino_corredor}-N${e.destino_nivel}-P${e.destino_posicao}`)
      if (e.localizacao_nome)  locSet.add(e.localizacao_nome)
      if (e.localizacao_origem_nome)  locSet.add(e.localizacao_origem_nome)
      if (e.localizacao_destino_nome) locSet.add(e.localizacao_destino_nome)
    })

    const timestamps = timeline
      .map(e => new Date(e.criado_em || e.data_movimentacao || 0).getTime())
      .filter(t => t > 0)
    const oldest = timestamps.length ? Math.min(...timestamps) : null
    const diasEstoque = oldest !== null ? Math.floor((Date.now() - oldest) / 86400000) : null

    return {
      movs:  timeline.length,
      locs:  locSet.size || 0,
      dias:  diasEstoque !== null ? `${diasEstoque}d` : '—',
      status: lote.status || null,
    }
  }, [lote, timeline])

  /* ── Derived ─────────────────────────────────────────────── */
  const rfidList = lote
    ? [lote.rfid, lote.codigo_identificacao, lote.identificacao_codigo].filter(Boolean)
    : []

  const showInitial  = !searched && !loading
  const showLoading  = loading
  const showNotFound = searched && !loading && notFound
  const showResult   = !loading && !!lote

  /* ── Render ──────────────────────────────────────────────── */
  return (
    <Layout breadcrumb={['Análise', 'Rastreabilidade']}>
      <div className="page-header">
        <div className="page-header-left">
          <h1>Rastreabilidade</h1>
          <div className="subtitle">
            <span>Rastreio completo por lote, RFID ou produto</span>
            <span className="sep" />
            <span>Log imutável · 7 anos</span>
          </div>
        </div>
        <div className="page-header-actions">
          <button className="btn btn-outline btn-sm" onClick={() => setRfidModalOpen(true)}>
            <ScanLine size={14} /> Escanear RFID
          </button>
        </div>
      </div>

      {/* Search card */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ padding: 20 }}>
          <form onSubmit={handleSearch} style={{ display: 'flex', gap: 10 }}>
            <div style={{ flex: 1, position: 'relative' }}>
              <Search size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-tertiary)', pointerEvents: 'none' }} />
              <input
                className="input"
                style={{ paddingLeft: 36, paddingRight: query ? 36 : 12, height: 40, fontSize: 14 }}
                placeholder="Código do lote, RFID ou nome do produto..."
                value={query}
                onChange={e => setQuery(e.target.value)}
                autoComplete="off"
              />
              {query && (
                <button
                  type="button"
                  onClick={clearSearch}
                  aria-label="Limpar busca"
                  style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-tertiary)', display: 'grid', placeItems: 'center', width: 20, height: 20 }}
                >
                  <X size={14} />
                </button>
              )}
            </div>
            <button
              type="submit"
              className="btn btn-primary"
              style={{ height: 40 }}
              disabled={loading || !query.trim()}
            >
              {loading ? 'Buscando…' : 'Rastrear'}
            </button>
          </form>
        </div>
      </div>

      {/* KPI Strip — always visible */}
      <div className="rst-kpi-grid">
        <RstKpiCard icon={Activity}    label="Movimentações"   value={kpis.movs} />
        <RstKpiCard icon={MapPin}      label="Localizações"    value={kpis.locs} />
        <RstKpiCard icon={Clock}       label="Dias em estoque" value={kpis.dias} />
        <RstKpiCard
          icon={ShieldCheck}
          label="Status atual"
          value={kpis.status ? capitalize(kpis.status) : '—'}
          valueColor={kpis.status ? statusColor(kpis.status) : undefined}
        />
      </div>

      {/* ═══ INITIAL STATE ═══ */}
      {showInitial && (
        <div className="rst-initial-grid">
          <div className="card" style={{ padding: 20 }}>
            <div className="rst-section-title"><Clock size={14} /> Buscas recentes</div>
            {recentSearches.map(term => (
              <button
                key={term}
                type="button"
                className="rst-recent-item"
                onClick={() => { setQuery(term); buscarTermo(term) }}
              >
                <Clock size={13} style={{ color: 'var(--color-text-tertiary)', flexShrink: 0 }} />
                <span style={{ fontFamily: '"IBM Plex Mono",monospace', fontSize: 12 }}>{term}</span>
              </button>
            ))}
          </div>

          <div className="card" style={{ padding: 20 }}>
            <div className="rst-section-title"><Activity size={14} /> Atalhos rápidos</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {['Lotes vencendo hoje', 'Sem localização', 'Bloqueados', 'RFID pendente'].map(label => (
                <button
                  key={label}
                  type="button"
                  className="btn btn-outline btn-sm"
                  style={{ justifyContent: 'flex-start' }}
                  onClick={() => toast.info('Em breve.')}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ═══ LOADING ═══ */}
      {showLoading && (
        <div className="rst-result-grid">
          <CardSkeleton />
          <div className="card">
            <div className="card-header">
              <span className="card-title">Histórico de movimentações</span>
            </div>
            <div style={{ padding: '12px 24px 24px' }}>
              <TimelineSkeleton count={4} />
            </div>
          </div>
        </div>
      )}

      {/* ═══ NOT FOUND ═══ */}
      {showNotFound && (
        <div className="empty-state" style={{ paddingTop: 64, paddingBottom: 64 }}>
          <div className="empty-icon empty-icon-animated"><Search size={24} /></div>
          <div className="empty-title">Nenhum resultado encontrado</div>
          <div className="empty-sub">Verifique o código do lote, RFID ou nome do produto</div>
          <button type="button" className="btn btn-outline btn-sm" style={{ marginTop: 8 }} onClick={clearSearch}>
            Limpar busca
          </button>
        </div>
      )}

      {/* ═══ RESULT ═══ */}
      {showResult && (
        <div className="rst-result-grid">

          {/* Left — identity card */}
          <div className="card" style={{ padding: 20, alignSelf: 'start' }}>
            <div style={{ fontFamily: '"IBM Plex Mono",monospace', fontSize: 17, fontWeight: 700, color: 'var(--color-brand-700)', letterSpacing: '-0.01em', wordBreak: 'break-all', marginBottom: 4 }}>
              {lote.codigo || lote.numero_lote || `#${lote.id}`}
            </div>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-text-primary)', marginBottom: 12 }}>
              {lote.produto_nome || '—'}
            </div>
            <div style={{ marginBottom: 4 }}>
              <span className={`badge ${statusCls(lote.status)}`}>{capitalize(lote.status) || '—'}</span>
            </div>

            <div className="rst-identity-rows">
              <div className="rst-identity-row">
                <span>Validade</span>
                <strong style={{ color: validadeColor(lote) }}>{fmtDateShort(lote.data_validade)}</strong>
              </div>
              <div className="rst-identity-row">
                <span>Quantidade</span>
                <strong>{lote.quantidade != null ? `${lote.quantidade} un.` : '—'}</strong>
              </div>
              <div className="rst-identity-row">
                <span>Localização</span>
                <strong style={{ fontFamily: '"IBM Plex Mono",monospace', fontSize: 11 }}>
                  {lote.corredor ? `${lote.corredor}-N${lote.nivel}-P${lote.posicao}` : (lote.localizacao_nome || '—')}
                </strong>
              </div>
              <div className="rst-identity-row">
                <span>Fabricação</span>
                <strong>{fmtDateShort(lote.data_fabricacao)}</strong>
              </div>
              <div className="rst-identity-row" style={{ alignItems: 'flex-start' }}>
                <span>RFID</span>
                <strong style={{ textAlign: 'right' }}>
                  {rfidList.length > 0
                    ? <span style={{ fontFamily: '"IBM Plex Mono",monospace', fontSize: 11 }}>{rfidList.join(', ')}</span>
                    : <span style={{ color: 'var(--color-text-tertiary)', fontWeight: 400 }}>Nenhum</span>
                  }
                </strong>
              </div>
            </div>
          </div>

          {/* Right — timeline */}
          <div className="card">
            <div className="card-header">
              <span className="card-title">Histórico de movimentações</span>
              <span style={{ fontSize: 11, color: 'var(--color-text-tertiary)', fontWeight: 600 }}>
                {timeline.length} eventos
              </span>
            </div>
            <div style={{ padding: '12px 24px 24px' }}>
              {timeline.length === 0 ? (
                <div className="empty-state" style={{ padding: '40px 0' }}>
                  <div className="empty-icon empty-icon-animated"><Activity size={24} /></div>
                  <div className="empty-title">Nenhuma movimentação registrada para este lote</div>
                </div>
              ) : (
                timeline.map((e, i) => {
                  const cfg = TIPO_CFG[e.tipo] || { icon: Activity, color: 'var(--color-text-secondary)', bg: 'var(--color-bg-muted)', label: e.tipo }
                  const Icon = cfg.icon
                  const loc = fmtLoc(e)
                  const hasLoc = loc && loc !== '—'

                  return (
                    <div key={e.id || i} style={{ display: 'flex', gap: 14 }}>
                      {/* Icon + connector */}
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
                        <div style={{ width: 36, height: 36, borderRadius: '50%', background: cfg.bg, display: 'grid', placeItems: 'center', color: cfg.color, flexShrink: 0 }}>
                          <Icon size={15} />
                        </div>
                        {i < timeline.length - 1 && (
                          <div style={{ width: 2, flex: 1, background: 'var(--color-border-default)', margin: '4px 0', minHeight: 16 }} />
                        )}
                      </div>

                      {/* Content */}
                      <div style={{ flex: 1, paddingBottom: 20, paddingTop: 6 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 4 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 700, padding: '2px 7px', borderRadius: 999, background: cfg.bg, color: cfg.color }}>
                              <Icon size={10} />{cfg.label || e.tipo}
                            </span>
                            {(e.motivo_movimentacao || e.descricao) && (
                              <span style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>
                                {e.motivo_movimentacao || e.descricao}
                              </span>
                            )}
                          </div>
                          <span style={{ fontWeight: 700, fontSize: 13, color: qtyColor(e), whiteSpace: 'nowrap', flexShrink: 0 }}>
                            {qtyLabel(e)}
                          </span>
                        </div>

                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px 12px', fontSize: 12, color: 'var(--color-text-tertiary)' }}>
                          <span style={{ fontFamily: '"IBM Plex Mono",monospace' }}>
                            {fmtDate(e.criado_em || e.data_movimentacao)}
                          </span>
                          {hasLoc && (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                              <MapPin size={11} style={{ flexShrink: 0 }} />{loc}
                            </span>
                          )}
                          {e.usuario_nome && <span>· {e.usuario_nome}</span>}
                        </div>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>

        </div>
      )}

      <RFIDModal
        isOpen={rfidModalOpen}
        onClose={() => setRfidModalOpen(false)}
        onConfirm={handleRFIDConfirm}
        mode="rastreabilidade"
      />

      <style>{`


        /* KPI Strip */
        .rst-kpi-grid { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:12px; margin-bottom:16px }
        .rst-kpi-card { display:flex; align-items:center; gap:12px; min-height:74px; padding:12px 14px; background:var(--color-bg-default); border:1px solid var(--color-border-default); border-radius:var(--radius-md); box-shadow:var(--shadow-xs) }
        .rst-kpi-icon { width:30px; height:30px; display:grid; place-items:center; background:var(--color-bg-subtle); border:1px solid var(--color-border-muted); border-radius:var(--radius-sm); flex-shrink:0; color:var(--color-text-secondary) }
        .rst-kpi-label { font-size:10px; font-weight:700; color:var(--color-text-tertiary); text-transform:uppercase; letter-spacing:0.08em }
        .rst-kpi-value { margin-top:2px; font-size:26px; line-height:1; font-weight:800; font-variant-numeric:tabular-nums; color:var(--color-text-primary) }

        /* Initial state */
        .rst-initial-grid { display:grid; grid-template-columns:1fr 1fr; gap:16px; margin-bottom:16px }
        .rst-section-title { display:flex; align-items:center; gap:6px; font-size:11px; font-weight:800; text-transform:uppercase; letter-spacing:0.07em; color:var(--color-text-secondary); margin-bottom:12px }
        .rst-recent-item { width:100%; display:flex; align-items:center; gap:10px; padding:9px 10px; border-radius:var(--radius-md); text-align:left; color:var(--color-text-primary); font-size:13px; transition:background 80ms }
        .rst-recent-item:hover { background:var(--color-bg-subtle) }

        /* Result layout */
        .rst-result-grid { display:grid; grid-template-columns:320px 1fr; gap:16px; align-items:start }

        /* Identity card rows */
        .rst-identity-rows { border-top:1px solid var(--color-border-muted); margin-top:12px; padding-top:2px }
        .rst-identity-row { display:flex; justify-content:space-between; align-items:center; gap:12px; padding:10px 0; border-bottom:1px solid var(--color-border-muted); font-size:13px }
        .rst-identity-row span { color:var(--color-text-tertiary); flex-shrink:0 }
        .rst-identity-row strong { color:var(--color-text-primary); font-weight:700; text-align:right }

        @media(max-width:1180px) { .rst-kpi-grid{grid-template-columns:repeat(2,minmax(0,1fr))} .rst-result-grid{grid-template-columns:1fr} .rst-initial-grid{grid-template-columns:1fr} }
        @media(max-width:700px)  { .rst-kpi-grid{grid-template-columns:1fr} }
      `}</style>
    </Layout>
  )
}

