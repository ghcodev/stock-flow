import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import Layout from '../components/Layout.jsx'
import { useToast } from '../context/ToastContext.jsx'
import api from '../api/axios.js'
import {
  Clock, CheckCircle, Lock, Download, Filter,
  AlertTriangle, MoreVertical, X, ShieldCheck,
} from 'lucide-react'

/* ─── Config (unchanged) ───────────────────────────────────── */
const NIVEL_CFG = {
  critical: { label: 'Crítico (≤15d)',   badgeCls: 'badge-danger',  border: 'var(--color-danger-200)',  bg: 'var(--color-danger-50)',  color: 'var(--color-danger-700)'  },
  warning:  { label: 'Alerta (16–30d)',  badgeCls: 'badge-warning', border: 'var(--color-warning-200)', bg: 'var(--color-warning-50)', color: 'var(--color-warning-700)' },
  info:     { label: 'Atenção (31–60d)', badgeCls: 'badge-info',    border: undefined,                  bg: undefined,                 color: 'var(--color-info-700)'    },
}

/* ─── Pure helpers ─────────────────────────────────────────── */
function nivel(dias) {
  if (dias <= 15) return 'critical'
  if (dias <= 30) return 'warning'
  return 'info'
}

function urgencyBadge(dias) {
  if (dias == null) return { label: '—', cls: 'badge-neutral' }
  if (dias <= 15) return { label: 'Crítico', cls: 'badge-danger'  }
  if (dias <= 30) return { label: 'Alerta',  cls: 'badge-warning' }
  return                 { label: 'Atenção', cls: 'badge-info'    }
}

function locStr(a) {
  if (a.corredor) return `${a.corredor}-N${a.nivel_loc || a.nivel}-P${a.posicao}`
  return a.localizacao_nome || '—'
}

function fmtDate(value) {
  return value ? new Date(value).toLocaleDateString('pt-BR') : '—'
}

/* ─── Sub-components ───────────────────────────────────────── */
function SkeletonRow() {
  return (
    <tr>
      {Array.from({ length: 8 }).map((_, i) => (
        <td key={i}>
          <div className="skeleton" style={{ height: 13 }} />
        </td>
      ))}
    </tr>
  )
}

function UrgencyBar({ dias }) {
  if (dias == null) return null
  let barColor, pct
  if (dias <= 5) {
    barColor = 'var(--color-danger-600)'
    pct = 100
  } else if (dias <= 15) {
    barColor = 'var(--color-danger-400)'
    pct = Math.round((dias / 15) * 100)
  } else if (dias <= 30) {
    barColor = 'var(--color-warning-500)'
    pct = Math.round((dias / 30) * 100)
  } else {
    barColor = 'var(--color-success-500)'
    pct = Math.min(Math.round((dias / 60) * 100), 100)
  }
  const dotColor = dias <= 5 ? 'var(--color-danger-700)' : dias <= 15 ? 'var(--color-danger-600)' : dias <= 30 ? 'var(--color-warning-700)' : 'var(--color-success-700)'
  return (
    <div>
      <div style={{ width: 80, height: 4, background: 'var(--color-bg-muted)', borderRadius: 2, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: barColor, borderRadius: 2, transition: 'width 200ms ease' }} />
      </div>
      <div style={{ marginTop: 4, fontSize: 11, fontWeight: 700, color: dotColor, display: 'flex', alignItems: 'center', gap: 4 }}>
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: barColor, flexShrink: 0, display: 'inline-block' }} />
        {dias} dias
      </div>
    </div>
  )
}

/* ─── Main component ───────────────────────────────────────── */
export default function AlertasVencimento() {
  const toast    = useToast()
  const navigate = useNavigate()

  const [alertas,       setAlertas]       = useState([])
  const [loading,       setLoading]       = useState(true)
  const [quickFilter,   setQuickFilter]   = useState('todos')
  const [openMenuId,    setOpenMenuId]    = useState(null)
  const [selectedAlerta, setSelectedAlerta] = useState(null)

  /* ── Load (unchanged) ────────────────────────────────────── */
  useEffect(() => { load() }, [])

  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') { setSelectedAlerta(null); setOpenMenuId(null) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    if (openMenuId === null) return
    function close() { setOpenMenuId(null) }
    const t = setTimeout(() => document.addEventListener('click', close), 0)
    return () => { clearTimeout(t); document.removeEventListener('click', close) }
  }, [openMenuId])

  async function load() {
    setLoading(true)
    try {
      const { data } = await api.get('/lotes/vencendo')
      setAlertas(data.data || data || [])
    } catch {
      toast.error('Erro ao carregar alertas de vencimento.')
    } finally {
      setLoading(false)
    }
  }

  async function handleBloquear(a) {
    setOpenMenuId(null)
    setSelectedAlerta(null)
    try {
      await api.patch(`/lotes/${a.id}/bloquear`)
      toast.success('Lote bloqueado.')
      load()
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erro ao bloquear lote.')
    }
  }

  function handleRegistrarUso(a) {
    setOpenMenuId(null)
    setSelectedAlerta(null)
    navigate(`/saida?lote=${encodeURIComponent(a.codigo || a.id)}`)
  }

  /* ── Computed ────────────────────────────────────────────── */
  const enriched   = alertas.map(a => ({ ...a, _nivel: nivel(a.dias_para_vencer ?? 999) }))
  const critical   = enriched.filter(a => a._nivel === 'critical')
  const warning    = enriched.filter(a => a._nivel === 'warning')
  const info       = enriched.filter(a => a._nivel === 'info')
  const bloqueados = enriched.filter(a => (a.status_lote || a.status || '').toLowerCase() === 'bloqueado')

  const filtered = quickFilter === 'critical'   ? critical
                 : quickFilter === 'warning'    ? warning
                 : quickFilter === 'info'       ? info
                 : quickFilter === 'bloqueados' ? bloqueados
                 : enriched

  /* ── Render ──────────────────────────────────────────────── */
  return (
    <Layout breadcrumb={['Análise', 'Alertas de Vencimento']}>
      <div className="page-header">
        <div className="page-header-left">
          <h1>Alertas de Vencimento</h1>
          <div className="subtitle">
            <span><strong style={{ color: 'var(--color-danger-700)', fontWeight: 600 }}>{critical.length}</strong> críticos (≤15 dias)</span>
            <span className="sep" />
            <span><strong style={{ color: 'var(--color-warning-700)', fontWeight: 600 }}>{warning.length}</strong> alertas (16–30 dias)</span>
            <span className="sep" />
            <span><strong style={{ fontWeight: 600 }}>{info.length}</strong> atenção (31–60 dias)</span>
          </div>
        </div>
        <div className="page-header-actions">
          <button type="button" className="btn btn-outline btn-sm"><Filter size={14} /> Filtrar</button>
          <button type="button" className="btn btn-outline btn-sm"><Download size={14} /> Exportar</button>
        </div>
      </div>

      {/* KPI Strip — summary-grid (melhorado com subtextos) */}
      <div className="summary-grid" style={{ gridTemplateColumns: 'repeat(4,1fr)', marginBottom: 16 }}>
        {[
          {
            l: 'Total de alertas',  v: enriched.length.toString(),
            sub: `Próximos 60 dias · ${enriched.length} lotes`,
          },
          {
            l: 'Críticos (≤15d)',   v: critical.length.toString(),
            sub: 'Ação imediata necessária',
            bg: 'var(--color-danger-50)', border: 'var(--color-danger-200)', color: 'var(--color-danger-700)',
          },
          {
            l: 'Alerta (16–30d)',   v: warning.length.toString(),
            sub: 'Planejar descarte ou uso',
            bg: 'var(--color-warning-50)', border: 'var(--color-warning-200)', color: 'var(--color-warning-700)',
          },
          {
            l: 'Atenção (31–60d)', v: info.length.toString(),
            sub: 'Monitorar',
          },
        ].map(c => (
          <div key={c.l} className="summary-card" style={{ background: c.bg, borderColor: c.border }}>
            <div className="label">{c.l}</div>
            <div className="value" style={{ color: c.color }}>{c.v}</div>
            <div style={{ fontSize: 12, color: c.color || 'var(--color-text-tertiary)', marginTop: 2 }}>{c.sub}</div>
          </div>
        ))}
      </div>

      {/* Full-page empty state when no data */}
      {!loading && enriched.length === 0 && (
        <div className="card">
          <div className="empty-state">
            <div className="empty-icon empty-icon-animated"><Clock size={24} /></div>
            <div className="empty-title">Nenhum alerta de vencimento</div>
            <div className="empty-sub">Todos os lotes estão dentro do prazo de validade.</div>
          </div>
        </div>
      )}

      {/* Table (always rendered when there's data or loading) */}
      {(loading || enriched.length > 0) && (
        <div className="table-wrap">
          {/* Filter strip */}
          <div className="alv-filter-strip">
            {[
              ['todos',      'Todos',           enriched.length   ],
              ['critical',   'Crítico ≤15d',    critical.length   ],
              ['warning',    'Alerta 16–30d',   warning.length    ],
              ['info',       'Atenção 31–60d',  info.length       ],
              ['bloqueados', 'Bloqueados',       bloqueados.length ],
            ].map(([id, label, count]) => (
              <button
                key={id}
                type="button"
                className={`alv-filter-chip${quickFilter === id ? ' active' : ''}`}
                onClick={() => setQuickFilter(id)}
              >
                {label} <span>{count}</span>
              </button>
            ))}
            <span className="alv-result-count">{loading ? '…' : `${filtered.length} lotes`}</span>
          </div>

          {/* Table */}
          <div className="alv-table-scroll">
            <table className="alv-table">
              <thead>
                <tr>
                  <th>Lote</th>
                  <th>Produto</th>
                  <th style={{ textAlign: 'center' }}>Dias rest.</th>
                  <th>Urgência</th>
                  <th>Validade</th>
                  <th style={{ textAlign: 'right' }}>Qtd. atual</th>
                  <th>Localização</th>
                  <th style={{ textAlign: 'right', width: 48 }}></th>
                </tr>
              </thead>
              <tbody>
                {loading
                  ? Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)
                  : filtered.length === 0
                    ? (
                      <tr><td colSpan={8}>
                        <div className="empty-state">
                          <div className="empty-icon empty-icon-animated"><AlertTriangle size={24} /></div>
                          <div className="empty-title">Nenhum lote neste filtro</div>
                          <div className="empty-sub">Tente outro filtro.</div>
                        </div>
                      </td></tr>
                    )
                    : filtered.map(a => {
                      const cfg  = NIVEL_CFG[a._nivel]
                      const loc  = locStr(a)
                      const isCritical5 = (a.dias_para_vencer ?? 999) <= 5

                      return (
                        <tr
                          key={a.id}
                          className="alv-row"
                          style={{
                            background: cfg.bg || undefined,
                            boxShadow: isCritical5 ? 'inset 3px 0 0 var(--color-danger-600)' : undefined,
                          }}
                          onClick={() => { setSelectedAlerta(a); setOpenMenuId(null) }}
                        >
                          <td style={{ fontFamily: '"IBM Plex Mono",monospace', fontSize: 11, fontWeight: 600, color: 'var(--color-brand-700)' }}>
                            {a.codigo || a.id}
                          </td>
                          <td style={{ fontWeight: 600 }}>{a.produto_nome || '—'}</td>
                          <td style={{ textAlign: 'center' }}>
                            {isCritical5 ? (
                              <span className="badge-ping">
                                <span className="badge badge-danger">
                                  {a.dias_para_vencer} dias
                                </span>
                              </span>
                            ) : (
                              <>
                                <span style={{ fontWeight: 800, fontSize: 16, color: cfg.color, fontVariantNumeric: 'tabular-nums' }}>
                                  {a.dias_para_vencer}
                                </span>
                                <span style={{ fontSize: 11, color: cfg.color, marginLeft: 4 }}>dias</span>
                              </>
                            )}
                          </td>
                          <td><UrgencyBar dias={a.dias_para_vencer} /></td>
                          <td style={{ fontFamily: '"IBM Plex Mono",monospace', fontSize: 12, color: cfg.color, fontWeight: 600 }}>
                            {fmtDate(a.data_validade)}
                          </td>
                          <td style={{ textAlign: 'right', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                            {a.quantidade ?? '—'}
                          </td>
                          <td style={{ fontFamily: '"IBM Plex Mono",monospace', fontSize: 11, color: 'var(--color-brand-700)', fontWeight: 500 }}>
                            {loc}
                          </td>
                          <td style={{ textAlign: 'right' }} onClick={e => e.stopPropagation()}>
                            <div className="alv-actions">
                              <button
                                type="button"
                                className="icon-btn"
                                aria-label="Ações"
                                onClick={() => setOpenMenuId(openMenuId === a.id ? null : a.id)}
                              >
                                <MoreVertical size={14} />
                              </button>
                              {openMenuId === a.id && (
                                <div className="alv-menu">
                                  <button type="button" onClick={() => handleRegistrarUso(a)}>
                                    <CheckCircle size={13} /> Registrar uso
                                  </button>
                                  <button
                                    type="button"
                                    className="alv-menu-danger"
                                    onClick={() => handleBloquear(a)}
                                  >
                                    <Lock size={13} /> Bloquear lote
                                  </button>
                                  <div className="alv-menu-sep" />
                                  <button type="button" onClick={() => { setOpenMenuId(null); navigate(`/lotes?search=${encodeURIComponent(a.codigo || a.id)}`) }}>
                                    <Filter size={13} /> Ver lote completo
                                  </button>
                                  <button type="button" onClick={() => { setOpenMenuId(null); navigate(`/rastreabilidade?lote=${encodeURIComponent(a.codigo || a.id)}`) }}>
                                    <ShieldCheck size={13} /> Ver rastreabilidade
                                  </button>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )
                    })
                }
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Drawer */}
      {selectedAlerta && (() => {
        const a    = selectedAlerta
        const cfg  = NIVEL_CFG[a._nivel]
        const urg  = urgencyBadge(a.dias_para_vencer ?? 999)
        const loc  = locStr(a)
        const ativo = (a.status_lote || a.status || '').toLowerCase() !== 'bloqueado'

        return (
          <div
            className="alv-drawer-layer"
            onMouseDown={e => { if (e.target === e.currentTarget) setSelectedAlerta(null) }}
          >
            <aside className="alv-drawer" role="dialog" aria-label="Detalhes do alerta">
              <div className="alv-drawer-header">
                <div>
                  <div className="alv-drawer-eyebrow">Alerta de Vencimento</div>
                  <div style={{ fontFamily: '"IBM Plex Mono",monospace', fontSize: 18, fontWeight: 700, color: 'var(--color-brand-700)', marginBottom: 6 }}>
                    {a.codigo || a.id}
                  </div>
                  <span className={`badge ${urg.cls}`}>{urg.label}</span>
                </div>
                <button className="icon-btn" onClick={() => setSelectedAlerta(null)} aria-label="Fechar">
                  <X size={15} />
                </button>
              </div>

              <div className="alv-drawer-body">
                {/* Produto */}
                <div className="alv-drawer-section">Produto</div>
                {[
                  ['Produto',     a.produto_nome || '—'],
                  ['Código lote', a.codigo || a.id],
                  ['Localização', loc],
                ].map(([label, value]) => (
                  <div key={label} className="alv-drawer-row">
                    <span>{label}</span><strong>{value}</strong>
                  </div>
                ))}

                {/* Validade */}
                <div className="alv-drawer-section" style={{ marginTop: 18, paddingTop: 14, borderTop: '1px solid var(--color-border-default)' }}>Validade</div>
                <div className="alv-drawer-row">
                  <span>Data de validade</span>
                  <strong style={{ color: cfg.color }}>{fmtDate(a.data_validade)}</strong>
                </div>
                <div className="alv-drawer-row">
                  <span>Dias restantes</span>
                  <strong style={{ fontSize: 22, color: cfg.color, fontVariantNumeric: 'tabular-nums' }}>
                    {a.dias_para_vencer} dias
                  </strong>
                </div>
                <div style={{ margin: '10px 0 6px' }}>
                  <UrgencyBar dias={a.dias_para_vencer} />
                </div>
                {a.data_fabricacao && (
                  <div className="alv-drawer-row">
                    <span>Fabricação</span><strong>{fmtDate(a.data_fabricacao)}</strong>
                  </div>
                )}

                {/* Estoque */}
                <div className="alv-drawer-section" style={{ marginTop: 18, paddingTop: 14, borderTop: '1px solid var(--color-border-default)' }}>Estoque</div>
                {[
                  ['Quantidade', `${a.quantidade ?? '—'} un.`],
                  ['Status',     a.status_lote || a.status || '—'],
                ].map(([label, value]) => (
                  <div key={label} className="alv-drawer-row">
                    <span>{label}</span><strong>{value}</strong>
                  </div>
                ))}

                {/* Ações */}
                <div className="alv-drawer-section" style={{ marginTop: 18, paddingTop: 14, borderTop: '1px solid var(--color-border-default)' }}>Ações</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    style={{ justifyContent: 'flex-start' }}
                    onClick={() => handleRegistrarUso(a)}
                  >
                    <CheckCircle size={13} /> Registrar uso
                  </button>
                  {ativo && (
                    <button
                      type="button"
                      className="btn btn-outline btn-sm"
                      style={{ justifyContent: 'flex-start', borderColor: 'var(--color-danger-200)', color: 'var(--color-danger-600)', background: 'var(--color-danger-50)' }}
                      onClick={() => handleBloquear(a)}
                    >
                      <Lock size={13} /> Bloquear lote
                    </button>
                  )}
                  <button
                    type="button"
                    className="btn btn-outline btn-sm"
                    style={{ justifyContent: 'flex-start' }}
                    onClick={() => { setSelectedAlerta(null); navigate(`/rastreabilidade?lote=${encodeURIComponent(a.codigo || a.id)}`) }}
                  >
                    <ShieldCheck size={13} /> Ver rastreabilidade
                  </button>
                </div>
              </div>
            </aside>
          </div>
        )
      })()}

      <style>{`
        @keyframes alv-drawer-in { from{opacity:0;transform:translateX(16px)} to{opacity:1;transform:translateX(0)} }

        /* Filter strip */
        .alv-filter-strip { display:flex; gap:8px; padding:10px 20px; border-bottom:1px solid var(--color-border-default); background:var(--color-bg-elevated); flex-wrap:wrap; align-items:center }
        .alv-filter-chip { display:inline-flex; align-items:center; gap:6px; height:28px; padding:0 10px; border:1px solid var(--color-border-default); border-radius:6px; background:var(--color-bg-default); color:var(--color-text-secondary); font-size:12px; font-weight:700; cursor:pointer; transition:background 100ms,border-color 100ms,color 100ms }
        .alv-filter-chip span { color:var(--color-text-tertiary); font-variant-numeric:tabular-nums }
        .alv-filter-chip:hover,.alv-filter-chip.active { background:var(--color-bg-subtle); border-color:var(--color-border-strong); color:var(--color-text-primary) }
        .alv-result-count { margin-left:auto; font-size:12px; color:var(--color-text-tertiary); white-space:nowrap }

        /* Table */
        .alv-table-scroll { overflow-x:auto; max-height:calc(100vh - 370px) }
        .alv-table thead th { position:sticky; top:0; z-index:2; background:var(--color-bg-elevated) }
        .alv-row { cursor:pointer; transition:background 80ms }
        .alv-row:hover { filter:brightness(0.97) }

        /* Context menu */
        .alv-actions { position:relative; display:inline-flex; justify-content:flex-end }
        .alv-menu { position:absolute; right:0; top:34px; z-index:10; min-width:200px; padding:6px; background:var(--color-bg-default); border:1px solid var(--color-border-default); border-radius:var(--radius-md); box-shadow:var(--shadow-md) }
        .alv-menu button { width:100%; display:flex; align-items:center; gap:8px; min-height:30px; padding:0 8px; border-radius:5px; color:var(--color-text-secondary); font-size:12px; font-weight:600; text-align:left }
        .alv-menu button:hover { background:var(--color-bg-subtle); color:var(--color-text-primary) }
        .alv-menu button.alv-menu-danger { color:var(--color-danger-600) }
        .alv-menu button.alv-menu-danger:hover { color:var(--color-danger-700) }
        .alv-menu-sep { height:1px; background:var(--color-border-muted); margin:4px 0 }

        /* Drawer */
        .alv-drawer-layer { position:fixed; inset:0; z-index:30; display:flex; justify-content:flex-end; background:transparent }
        .alv-drawer { width:min(480px,100%); height:100%; background:var(--color-bg-default); border-left:1px solid var(--color-border-default); box-shadow:var(--shadow-lg); animation:alv-drawer-in 160ms ease-out; display:flex; flex-direction:column }
        .alv-drawer-header { display:flex; justify-content:space-between; align-items:flex-start; gap:16px; padding:20px; border-bottom:1px solid var(--color-border-default); background:var(--color-bg-elevated) }
        .alv-drawer-eyebrow { color:var(--color-text-tertiary); font-size:10px; font-weight:800; letter-spacing:0.08em; text-transform:uppercase; margin-bottom:4px }
        .alv-drawer-body { flex:1; overflow:auto; padding:16px 20px }
        .alv-drawer-section { font-size:11px; font-weight:800; text-transform:uppercase; letter-spacing:0.07em; color:var(--color-text-tertiary); margin-bottom:8px }
        .alv-drawer-row { display:flex; justify-content:space-between; align-items:center; gap:16px; padding:10px 0; border-bottom:1px solid var(--color-border-muted); font-size:13px }
        .alv-drawer-row span { color:var(--color-text-tertiary); flex-shrink:0 }
        .alv-drawer-row strong { color:var(--color-text-primary); font-weight:700; text-align:right }

        @media(max-width:700px) { .alv-table-scroll{max-height:none} }
      `}</style>
    </Layout>
  )
}

