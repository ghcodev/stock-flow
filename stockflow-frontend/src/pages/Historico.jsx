import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import Layout from '../components/Layout.jsx'
import { useToast } from '../context/ToastContext.jsx'
import api from '../api/axios.js'
import {
  Download, Search, ArrowDownLeft, ArrowUpRight, Shuffle,
  Calendar, Activity, MoreVertical, ChevronLeft, ChevronRight,
  X, ShieldCheck, Copy,
} from 'lucide-react'

/* ─── Tipo config (unchanged) ──────────────────────────────── */
const TIPO_CFG = {
  entrada:       { icon: ArrowDownLeft, color: 'var(--color-success-600)', bg: 'var(--color-success-100)', label: 'Entrada'       },
  saida:         { icon: ArrowUpRight,  color: 'var(--color-danger-600)',  bg: 'var(--color-danger-100)',  label: 'Saída'         },
  transferencia: { icon: Shuffle,       color: 'var(--color-brand-600)',   bg: 'var(--color-brand-100)',   label: 'Transferência' },
  ajuste:        { icon: Activity,      color: 'var(--color-admin-600)',   bg: 'var(--color-admin-100)',   label: 'Ajuste'        },
}

const PAGE_SIZE = 20

/* ─── Helpers ──────────────────────────────────────────────── */
function impactBadge(qty) {
  const abs = Math.abs(Number(qty || 0))
  if (abs >= 200) return { label: 'Alto',  bg: 'var(--color-danger-50)',  border: 'var(--color-danger-200)',   color: 'var(--color-danger-700)'   }
  if (abs >= 50)  return { label: 'Médio', bg: 'var(--color-warning-50)', border: 'var(--color-warning-200)',  color: 'var(--color-warning-700)'  }
  return               { label: 'Baixo', bg: 'var(--color-bg-muted)',    border: 'var(--color-border-default)', color: 'var(--color-text-secondary)' }
}

function tipoBadge(tipo) {
  const cfg = TIPO_CFG[tipo] || { icon: Activity, color: 'var(--color-text-secondary)', bg: 'var(--color-bg-muted)', label: tipo }
  const Icon = cfg.icon
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 999, background: cfg.bg, color: cfg.color }}>
      <Icon size={11} />{cfg.label}
    </span>
  )
}

/* ─── Pure helpers (module scope) ─────────────────────────── */
function qtyLabel(m) {
  if (m.tipo === 'entrada') return `+${m.quantidade}`
  if (m.tipo === 'saida')   return `-${m.quantidade}`
  return String(m.quantidade)
}

function locLabel(m) {
  if (m.tipo === 'transferencia') {
    const ori = m.localizacao_origem_nome || (m.origem_corredor ? `${m.origem_corredor}-N${m.origem_nivel}-P${m.origem_posicao}` : '?')
    const dst = m.localizacao_destino_nome || (m.destino_corredor ? `${m.destino_corredor}-N${m.destino_nivel}-P${m.destino_posicao}` : '?')
    return `${ori}→${dst}`
  }
  if (m.tipo === 'entrada' && m.localizacao_destino_nome) return m.localizacao_destino_nome
  if (m.tipo === 'saida'   && m.localizacao_origem_nome)  return m.localizacao_origem_nome
  if (m.localizacao_nome) return m.localizacao_nome
  return m.localizacao || '—'
}

function fmtDT(value) {
  return value ? new Date(value).toLocaleString('pt-BR') : '—'
}

/* ─── Sub-components ───────────────────────────────────────── */
function SkeletonRow() {
  return (
    <tr>
      {Array.from({ length: 10 }).map((_, i) => (
        <td key={i}>
          <div className="skeleton" style={{ height: 13 }} />
        </td>
      ))}
    </tr>
  )
}

function HisKpiCard({ icon: Icon, label, value, iconColor, valueColor }) {
  return (
    <div className="his-kpi-card">
      <div className="his-kpi-icon" style={{ color: iconColor }}><Icon size={16} /></div>
      <div>
        <div className="his-kpi-label">{label}</div>
        <div className="his-kpi-value" style={{ color: valueColor }}>{value}</div>
      </div>
    </div>
  )
}

/* ─── Main component ───────────────────────────────────────── */
export default function Historico() {
  const toast    = useToast()
  const navigate = useNavigate()

  const [movs,        setMovs]        = useState([])
  const [total,       setTotal]       = useState(0)
  const [loading,     setLoading]     = useState(true)
  const [search,      setSearch]      = useState('')
  const [tipoFilter,  setTipoFilter]  = useState('todos')
  const [selectedMov, setSelectedMov] = useState(null)
  const [openMenuId,  setOpenMenuId]  = useState(null)
  const [page,        setPage]        = useState(0)

  /* ── Load (unchanged API call) ─────────────────────────── */
  useEffect(() => {
    const t = setTimeout(() => load(), 300)
    return () => clearTimeout(t)
  }, [search])

  /* ── Reset page on filter/search change ─────────────────── */
  useEffect(() => { setPage(0) }, [tipoFilter, search])

  /* ── ESC closes drawer and menu ─────────────────────────── */
  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') { setSelectedMov(null); setOpenMenuId(null) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  async function load() {
    setLoading(true)
    try {
      const { data } = await api.get('/movimentacoes', { params: { search, limit: 100 } })
      setMovs(data.data || data || [])
      setTotal(data.total || (data.data || data || []).length)
    } catch {
      toast.error('Erro ao carregar histórico.')
    } finally {
      setLoading(false)
    }
  }

  /* ── KPIs (client-side, from movs) ─────────────────────── */
  const kpis = useMemo(() => {
    const today = new Date().toDateString()
    const todayMovs = movs.filter(m => {
      const dt = m.data_movimentacao || m.criado_em
      return dt && new Date(dt).toDateString() === today
    })
    return {
      entradas:       todayMovs.filter(m => m.tipo === 'entrada').length,
      saidas:         todayMovs.filter(m => m.tipo === 'saida').length,
      transferencias: todayMovs.filter(m => m.tipo === 'transferencia').length,
      ajustes:        todayMovs.filter(m => m.tipo === 'ajuste').length,
    }
  }, [movs])

  /* ── Filtering + pagination ─────────────────────────────── */
  const { filtered, totalFiltered, totalPages, pageData, fromIdx, toIdx } = useMemo(() => {
    const f = tipoFilter === 'todos' ? movs : movs.filter(m => m.tipo === tipoFilter)
    const total   = f.length
    const tPages  = Math.max(1, Math.ceil(total / PAGE_SIZE))
    const pData   = f.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)
    return {
      filtered:      f,
      totalFiltered: total,
      totalPages:    tPages,
      pageData:      pData,
      fromIdx:       total === 0 ? 0 : page * PAGE_SIZE + 1,
      toIdx:         page * PAGE_SIZE + pData.length,
    }
  }, [movs, tipoFilter, page])

  async function copyId(m) {
    try {
      await navigator.clipboard.writeText(String(m.id))
      toast.info('ID copiado')
    } catch {
      toast.error('Não foi possível copiar.')
    }
  }

  /* ── Render ──────────────────────────────────────────────── */
  return (
    <Layout breadcrumb={['Análise', 'Histórico']}>
      <div className="page-header">
        <div className="page-header-left">
          <h1>Histórico de Movimentações</h1>
          <div className="subtitle">
            <span className="live-dot" />
            <span><strong style={{ fontWeight: 600 }}>{total}</strong> movimentações</span>
            <span className="sep" />
            <span>Log imutável · retenção 7 anos</span>
          </div>
        </div>
        <div className="page-header-actions">
          <button className="btn btn-outline btn-sm"><Calendar size={14} /> Período</button>
          <button className="btn btn-outline btn-sm"><Download size={14} /> Exportar</button>
        </div>
      </div>

      {/* KPI Strip */}
      <div className="his-kpi-grid">
        <HisKpiCard icon={ArrowDownLeft} label="Entradas Hoje"   value={kpis.entradas}       iconColor="var(--color-success-600)" valueColor="var(--color-success-700)" />
        <HisKpiCard icon={ArrowUpRight}  label="Saídas Hoje"     value={kpis.saidas}         iconColor="var(--color-danger-600)"  valueColor="var(--color-danger-700)"  />
        <HisKpiCard icon={Shuffle}       label="Transferências"  value={kpis.transferencias} iconColor="var(--color-brand-600)"   valueColor="var(--color-brand-700)"   />
        <HisKpiCard icon={Activity}      label="Ajustes"         value={kpis.ajustes}        iconColor="var(--color-warning-600)" valueColor="var(--color-warning-700)" />
      </div>

      {/* Type filter (unchanged) */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {['todos', 'entrada', 'saida', 'transferencia', 'ajuste'].map(t => (
          <button
            key={t}
            onClick={() => setTipoFilter(t)}
            className={`btn btn-sm ${tipoFilter === t ? 'btn-primary' : 'btn-outline'}`}
          >
            {t === 'todos' ? 'Todos' : TIPO_CFG[t]?.label || t}
          </button>
        ))}
      </div>

      <div className="table-wrap">
        <div className="table-toolbar">
          <div className="table-search">
            <Search size={14} />
            <input
              type="text"
              placeholder="Buscar por lote, produto ou ID…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <span className="his-result-count">{totalFiltered} resultados</span>
        </div>

        <div className="his-table-scroll">
          <table className="his-table">
            <thead>
              <tr>
                <th>Tipo</th>
                <th>ID</th>
                <th>Data / Hora</th>
                <th>Lote</th>
                <th>Produto</th>
                <th style={{ textAlign: 'right' }}>Qtd</th>
                <th>Impacto</th>
                <th>Localização</th>
                <th>Operador</th>
                <th style={{ textAlign: 'right', width: 48 }}></th>
              </tr>
            </thead>
            <tbody>
              {loading
                ? Array.from({ length: 6 }).map((_, i) => <SkeletonRow key={i} />)
                : pageData.length === 0
                  ? (
                    <tr><td colSpan={10}>
                      <div className="empty-state">
                        <div className="empty-icon empty-icon-animated"><Activity size={24} /></div>
                        <div className="empty-title">Nenhuma movimentação encontrada</div>
                      </div>
                    </td></tr>
                  )
                  : pageData.map((m, i) => {
                    const cfg    = TIPO_CFG[m.tipo] || { icon: Activity, color: 'var(--color-text-secondary)', bg: 'var(--color-bg-muted)', label: m.tipo }
                    const impact = impactBadge(m.quantidade)
                    const isEntrada = m.tipo === 'entrada'
                    const isSaida   = m.tipo === 'saida'
                    const rowKey    = m.id ?? i

                    return (
                      <tr
                        key={rowKey}
                        className="his-row"
                        onClick={() => { setSelectedMov(m); setOpenMenuId(null) }}
                      >
                        <td>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 999, background: cfg.bg, color: cfg.color }}>
                            <cfg.icon size={11} />{cfg.label}
                          </span>
                        </td>
                        <td style={{ fontFamily: '"IBM Plex Mono",monospace', fontSize: 11, color: 'var(--color-brand-700)', fontWeight: 500 }}>{m.id}</td>
                        <td style={{ fontFamily: '"IBM Plex Mono",monospace', fontSize: 11 }}>
                          {fmtDT(m.data_movimentacao || m.criado_em)}
                        </td>
                        <td style={{ fontFamily: '"IBM Plex Mono",monospace', fontSize: 11 }}>{m.numero_lote || m.codigo_lote || m.id_lote}</td>
                        <td style={{ fontWeight: 600 }}>{m.produto_nome || '—'}</td>
                        <td style={{ textAlign: 'right', fontWeight: 700, color: isEntrada ? 'var(--color-success-600)' : isSaida ? 'var(--color-danger-600)' : 'var(--color-text-primary)' }}>
                          {qtyLabel(m)}
                        </td>
                        <td>
                          <span style={{ display: 'inline-flex', alignItems: 'center', height: 22, padding: '0 8px', borderRadius: 999, border: `1px solid ${impact.border}`, background: impact.bg, color: impact.color, fontSize: 11, fontWeight: 800 }}>
                            {impact.label}
                          </span>
                        </td>
                        <td style={{ fontFamily: '"IBM Plex Mono",monospace', fontSize: 11, color: 'var(--color-brand-700)' }}>{locLabel(m)}</td>
                        <td style={{ fontSize: 12 }}>{m.usuario_nome || '—'}</td>
                        <td style={{ textAlign: 'right' }} onClick={e => e.stopPropagation()}>
                          <div className="his-actions">
                            <button
                              className="icon-btn"
                              aria-label="Ações"
                              onClick={() => setOpenMenuId(openMenuId === rowKey ? null : rowKey)}
                            >
                              <MoreVertical size={14} />
                            </button>
                            {openMenuId === rowKey && (
                              <div className="his-menu">
                                <button type="button" onClick={() => { setSelectedMov(m); setOpenMenuId(null) }}>
                                  <Activity size={13} /> Ver detalhes
                                </button>
                                <button type="button" onClick={() => { copyId(m); setOpenMenuId(null) }}>
                                  <Copy size={13} /> Copiar ID
                                </button>
                                <button type="button" onClick={() => navigate(`/rastreabilidade?lote=${m.numero_lote || m.id_lote}`)}>
                                  <ShieldCheck size={13} /> Rastrear lote
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

        <div className="pagination">
          <span className="pagination-info">
            {totalFiltered === 0
              ? 'Sem resultados'
              : `Exibindo ${fromIdx}–${toIdx} de ${totalFiltered} movimentações`}
          </span>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <button
              className="pagination-btn"
              disabled={page === 0}
              onClick={() => setPage(p => Math.max(0, p - 1))}
              aria-label="Página anterior"
            >
              <ChevronLeft size={14} />
            </button>
            <span style={{ fontSize: 12, color: 'var(--color-text-secondary)', minWidth: 56, textAlign: 'center' }}>
              {page + 1} / {totalPages}
            </span>
            <button
              className="pagination-btn"
              disabled={page >= totalPages - 1}
              onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
              aria-label="Próxima página"
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* Drawer lateral */}
      {selectedMov && (
        <div
          className="his-drawer-layer"
          onMouseDown={e => { if (e.target === e.currentTarget) setSelectedMov(null) }}
        >
          <aside className="his-drawer" role="dialog" aria-label="Detalhes da movimentação">
            <div className="his-drawer-header">
              <div>
                <div className="his-drawer-eyebrow">Movimentação</div>
                {tipoBadge(selectedMov.tipo)}
                <h2>#{selectedMov.id}</h2>
              </div>
              <button className="icon-btn" onClick={() => setSelectedMov(null)} aria-label="Fechar">
                <X size={15} />
              </button>
            </div>

            <div className="his-drawer-body">
              <div className="his-drawer-section">Identificação</div>
              {[
                ['ID',      selectedMov.id],
                ['Lote',    selectedMov.numero_lote || selectedMov.codigo_lote || selectedMov.id_lote || '—'],
                ['Produto', selectedMov.produto_nome || '—'],
              ].map(([label, value]) => (
                <div key={label} className="his-drawer-row">
                  <span>{label}</span><strong>{value}</strong>
                </div>
              ))}

              <div className="his-drawer-section" style={{ marginTop: 18, paddingTop: 14, borderTop: '1px solid var(--color-border-default)' }}>Detalhes da operação</div>
              {[
                ['Tipo',        (TIPO_CFG[selectedMov.tipo] || {}).label || selectedMov.tipo || '—'],
                ['Quantidade',  qtyLabel(selectedMov)],
                ['Localização', locLabel(selectedMov)],
                ['Operador',    selectedMov.usuario_nome || '—'],
                ['Data / Hora', fmtDT(selectedMov.data_movimentacao || selectedMov.criado_em)],
              ].map(([label, value]) => (
                <div key={label} className="his-drawer-row">
                  <span>{label}</span><strong>{value}</strong>
                </div>
              ))}

              <div className="his-drawer-section" style={{ marginTop: 18, paddingTop: 14, borderTop: '1px solid var(--color-border-default)' }}>Auditoria</div>
              <div className="his-drawer-audit">
                <ShieldCheck size={14} style={{ flexShrink: 0 }} />
                <span>Log imutável · retenção 7 anos</span>
              </div>
              <div className="his-drawer-row">
                <span>Data de registro</span>
                <strong>{fmtDT(selectedMov.criado_em || selectedMov.data_movimentacao)}</strong>
              </div>
            </div>

            <div className="his-drawer-actions">
              <button
                className="btn btn-outline btn-sm"
                onClick={() => navigate(`/rastreabilidade?lote=${selectedMov.numero_lote || selectedMov.id_lote}`)}
              >
                <ShieldCheck size={13} /> Rastrear lote
              </button>
              <button className="btn btn-outline btn-sm" onClick={() => copyId(selectedMov)}>
                <Copy size={13} /> Copiar ID
              </button>
            </div>
          </aside>
        </div>
      )}

      <style>{`
        @keyframes his-drawer-in { from{opacity:0;transform:translateX(16px)} to{opacity:1;transform:translateX(0)} }

        /* KPI Strip */
        .his-kpi-grid { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:12px; margin-bottom:16px }
        .his-kpi-card { display:flex; align-items:center; gap:12px; min-height:74px; padding:12px 14px; background:var(--color-bg-default); border:1px solid var(--color-border-default); border-radius:var(--radius-md); box-shadow:var(--shadow-xs) }
        .his-kpi-icon { width:30px; height:30px; display:grid; place-items:center; background:var(--color-bg-subtle); border:1px solid var(--color-border-muted); border-radius:var(--radius-sm); flex-shrink:0 }
        .his-kpi-label { font-size:10px; font-weight:700; color:var(--color-text-tertiary); text-transform:uppercase; letter-spacing:0.08em }
        .his-kpi-value { margin-top:2px; font-size:26px; line-height:1; font-weight:800; font-variant-numeric:tabular-nums }

        /* Table */
        .his-result-count { margin-left:auto; font-size:12px; color:var(--color-text-tertiary); white-space:nowrap }
        .his-table-scroll { overflow-x:auto; max-height:calc(100vh - 400px) }
        .his-table thead th { position:sticky; top:0; z-index:2; background:var(--color-bg-elevated) }
        .his-row { cursor:pointer; transition:background 80ms }
        .his-row:hover { background:var(--color-bg-subtle) }

        /* Context menu */
        .his-actions { position:relative; display:inline-flex; justify-content:flex-end }
        .his-menu { position:absolute; right:0; top:34px; z-index:10; min-width:178px; padding:6px; background:var(--color-bg-default); border:1px solid var(--color-border-default); border-radius:var(--radius-md); box-shadow:var(--shadow-md) }
        .his-menu button { width:100%; display:flex; align-items:center; gap:8px; min-height:30px; padding:0 8px; border-radius:5px; color:var(--color-text-secondary); font-size:12px; font-weight:600; text-align:left }
        .his-menu button:hover { background:var(--color-bg-subtle); color:var(--color-text-primary) }

        /* Drawer */
        .his-drawer-layer { position:fixed; inset:0; z-index:30; display:flex; justify-content:flex-end; background:transparent }
        .his-drawer { width:min(480px,100%); height:100%; background:var(--color-bg-default); border-left:1px solid var(--color-border-default); box-shadow:var(--shadow-lg); animation:his-drawer-in 160ms ease-out; display:flex; flex-direction:column }
        .his-drawer-header { display:flex; justify-content:space-between; gap:16px; padding:20px; border-bottom:1px solid var(--color-border-default); background:var(--color-bg-elevated) }
        .his-drawer-eyebrow { color:var(--color-text-tertiary); font-size:10px; font-weight:800; letter-spacing:0.08em; text-transform:uppercase; margin-bottom:6px }
        .his-drawer h2 { margin:6px 0 0; color:var(--color-text-primary); font-family:"IBM Plex Mono",monospace; font-size:20px }
        .his-drawer-body { flex:1; overflow:auto; padding:16px 20px }
        .his-drawer-section { font-size:11px; font-weight:800; text-transform:uppercase; letter-spacing:0.07em; color:var(--color-text-tertiary); margin-bottom:8px }
        .his-drawer-row { display:flex; justify-content:space-between; gap:16px; padding:10px 0; border-bottom:1px solid var(--color-border-muted); font-size:13px }
        .his-drawer-row span { color:var(--color-text-tertiary) }
        .his-drawer-row strong { color:var(--color-text-primary); font-weight:700; text-align:right }
        .his-drawer-audit { display:flex; align-items:center; gap:8px; padding:10px 12px; background:var(--color-success-50); border:1px solid var(--color-success-200); border-radius:var(--radius-md); font-size:12px; color:var(--color-success-700); margin-bottom:8px }
        .his-drawer-actions { display:flex; gap:8px; padding:14px 20px; border-top:1px solid var(--color-border-default); flex-wrap:wrap }

        @media(max-width:1180px) { .his-kpi-grid{grid-template-columns:repeat(2,minmax(0,1fr))} }
        @media(max-width:700px)  { .his-kpi-grid{grid-template-columns:1fr} .his-table-scroll{max-height:none} .his-drawer-actions .btn{width:100%;justify-content:center} }
      `}</style>
    </Layout>
  )
}

