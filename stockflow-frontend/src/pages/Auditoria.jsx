import { useState, useEffect, useMemo } from 'react'
import Layout from '../components/Layout.jsx'
import { useToast } from '../context/ToastContext.jsx'
import api from '../api/axios.js'
import {
  Shield, Download, Search, Filter, ArrowDownLeft, ArrowUpRight, Shuffle,
  Edit, Lock, LogIn, Activity, Copy, X, AlertTriangle, Users, Clock, ShieldCheck,
} from 'lucide-react'

/* ─── Config (unchanged) ───────────────────────────────────── */
const ACAO_CFG = {
  ENTRADA:       { icon: ArrowDownLeft, color: 'var(--color-success-600)', bg: 'var(--color-success-100)' },
  SAIDA:         { icon: ArrowUpRight,  color: 'var(--color-danger-600)',  bg: 'var(--color-danger-100)'  },
  TRANSFERENCIA: { icon: Shuffle,       color: 'var(--color-brand-600)',   bg: 'var(--color-brand-100)'   },
  LOGIN:         { icon: LogIn,         color: 'var(--color-info-700)',    bg: 'var(--color-info-100)'    },
  USUARIO_EDIT:  { icon: Edit,          color: 'var(--color-admin-700)',   bg: 'var(--color-admin-100)'   },
  BLOQUEIO:      { icon: Lock,          color: 'var(--color-warning-700)', bg: 'var(--color-warning-100)' },
  AJUSTE:        { icon: Activity,      color: 'var(--color-admin-700)',   bg: 'var(--color-admin-100)'   },
}

const PAGE_SIZE = 50

/* ─── Pure helpers ─────────────────────────────────────────── */
function isToday(value) {
  if (!value) return false
  return new Date(value).toDateString() === new Date().toDateString()
}

function getSeverity(acao) {
  const a = String(acao || '').toUpperCase()
  if (a.includes('DELETE') || a.includes('INATIV'))
    return { label: 'Alta',  bg: 'var(--color-danger-50)',  border: 'var(--color-danger-200)',   color: 'var(--color-danger-700)'   }
  if (a.includes('UPDATE') || a.includes('AJUSTE'))
    return { label: 'Média', bg: 'var(--color-warning-50)', border: 'var(--color-warning-200)',  color: 'var(--color-warning-700)'  }
  return    { label: 'Info', bg: 'var(--color-bg-muted)',   border: 'var(--color-border-default)', color: 'var(--color-text-secondary)' }
}

function formatDetalhe(raw) {
  if (!raw) return null
  try { return JSON.stringify(JSON.parse(raw), null, 2) } catch { return raw }
}

function fmtDT(value) {
  return value ? new Date(value).toLocaleString('pt-BR') : '—'
}

/* ─── Sub-components ───────────────────────────────────────── */
function SkeletonRow() {
  return (
    <tr>
      {Array.from({ length: 9 }).map((_, i) => (
        <td key={i}>
          <div className="skeleton" style={{ height: 13 }} />
        </td>
      ))}
    </tr>
  )
}

function AudKpiCard({ icon: Icon, label, value, tone }) {
  const color = {
    danger:  'var(--color-danger-600)',
    warning: 'var(--color-warning-600)',
    brand:   'var(--color-brand-600)',
    info:    'var(--color-info-600)',
    success: 'var(--color-success-600)',
  }[tone] || 'var(--color-text-secondary)'
  return (
    <div className="aud-kpi-card">
      <div className="aud-kpi-icon" style={{ color }}><Icon size={16} /></div>
      <div>
        <div className="aud-kpi-label">{label}</div>
        <div className="aud-kpi-value">{value}</div>
      </div>
    </div>
  )
}

/* ─── Main component ───────────────────────────────────────── */
export default function Auditoria() {
  const toast = useToast()
  const [logs,        setLogs]        = useState([])
  const [total,       setTotal]       = useState(0)
  const [loading,     setLoading]     = useState(true)
  const [search,      setSearch]      = useState('')
  const [quickFilter, setQuickFilter] = useState('todos')
  const [selectedLog, setSelectedLog] = useState(null)
  const [page,        setPage]        = useState(0)

  /* ── Load (API unchanged) ────────────────────────────────── */
  useEffect(() => {
    const t = setTimeout(() => load(), 300)
    return () => clearTimeout(t)
  }, [search])

  useEffect(() => { setPage(0) }, [quickFilter, search])

  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') setSelectedLog(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  async function load() {
    setLoading(true)
    try {
      const { data } = await api.get('/auditoria', { params: { search, limit: 50 } })
      setLogs(data.data || data || [])
      setTotal(data.total || (data.data || data || []).length)
    } catch {
      toast.error('Erro ao carregar log de auditoria.')
    } finally {
      setLoading(false)
    }
  }

  /* ── KPIs ────────────────────────────────────────────────── */
  const kpis = useMemo(() => {
    if (!logs.length) return { hoje: 0, criticas: 0, usuarios: 0, ultimoEvento: '—' }
    const todayLogs  = logs.filter(l => isToday(l.data_hora || l.criado_em))
    const criticas   = logs.filter(l => {
      const a = (l.acao || l.operacao || '').toUpperCase()
      return a.includes('DELETE') || a.includes('AJUSTE') || a.includes('INATIV')
    })
    const userSet    = new Set(logs.map(l => l.usuario_nome || l.usuario).filter(Boolean))
    const timestamps = logs.map(l => new Date(l.data_hora || l.criado_em || 0).getTime()).filter(t => t > 0)
    const latest     = timestamps.length ? new Date(Math.max(...timestamps)) : null
    return {
      hoje:         todayLogs.length,
      criticas:     criticas.length,
      usuarios:     userSet.size,
      ultimoEvento: latest ? latest.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '—',
    }
  }, [logs])

  /* ── Filtering + pagination ──────────────────────────────── */
  const { pageData, totalFiltered, totalPages, fromIdx, toIdx, filterCounts } = useMemo(() => {
    const ws = search
      ? logs.filter(l =>
          [l.usuario_nome, l.usuario, l.acao, l.operacao, l.entidade,
           l.tabela_afetada, l.detalhe, l.observacao, l.valor_novo]
            .some(v => String(v || '').toLowerCase().includes(search.toLowerCase()))
        )
      : logs

    const counts = {
      todos:  ws.length,
      hoje:   ws.filter(l => isToday(l.data_hora || l.criado_em)).length,
      LOGIN:  ws.filter(l => (l.acao || l.operacao || '').toUpperCase().includes('LOGIN')).length,
      INSERT: ws.filter(l => (l.acao || l.operacao || '').toUpperCase().includes('INSERT')).length,
      UPDATE: ws.filter(l => (l.acao || l.operacao || '').toUpperCase().includes('UPDATE')).length,
      DELETE: ws.filter(l => (l.acao || l.operacao || '').toUpperCase().includes('DELETE')).length,
    }

    const wqf = ws.filter(l => {
      if (quickFilter === 'todos') return true
      if (quickFilter === 'hoje')  return isToday(l.data_hora || l.criado_em)
      return (l.acao || l.operacao || '').toUpperCase().includes(quickFilter)
    })

    const total  = wqf.length
    const tPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
    const pData  = wqf.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

    return {
      pageData:      pData,
      totalFiltered: total,
      totalPages:    tPages,
      fromIdx:       total === 0 ? 0 : page * PAGE_SIZE + 1,
      toIdx:         page * PAGE_SIZE + pData.length,
      filterCounts:  counts,
    }
  }, [logs, search, quickFilter, page])

  async function copyHash(hash, e) {
    e?.stopPropagation()
    try {
      await navigator.clipboard.writeText(hash)
      toast.info('Hash copiado')
    } catch {
      toast.error('Não foi possível copiar.')
    }
  }

  /* ── Render ──────────────────────────────────────────────── */
  return (
    <Layout breadcrumb={['Administração', 'Auditoria']}>
      <div className="page-header">
        <div className="page-header-left">
          <h1>Log de Auditoria</h1>
          <div className="subtitle">
            <span className="live-dot" />
            <span>Log imutável · hash SHA-256</span>
            <span className="sep" />
            <span><strong style={{ fontWeight: 600 }}>{total.toLocaleString('pt-BR')}</strong> registros · retenção 7 anos</span>
            <span className="sep" />
            <span style={{ background: 'var(--color-admin-100)', color: 'var(--color-admin-700)', padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 700 }}>Somente Admin</span>
          </div>
        </div>
        <div className="page-header-actions">
          <button type="button" className="btn btn-outline btn-sm"><Filter size={14} /> Filtros</button>
          <button type="button" className="btn btn-outline btn-sm"><Download size={14} /> Exportar</button>
        </div>
      </div>

      {/* KPI Strip */}
      <div className="aud-kpi-grid">
        <AudKpiCard icon={Shield}        label="Registros Hoje"      value={kpis.hoje}         tone="brand"   />
        <AudKpiCard icon={AlertTriangle} label="Operações Críticas"  value={kpis.criticas}     tone="danger"  />
        <AudKpiCard icon={Users}         label="Usuários Ativos"     value={kpis.usuarios}     tone="info"    />
        <AudKpiCard icon={Clock}         label="Último Evento"       value={kpis.ultimoEvento} tone="warning" />
      </div>

      <div className="table-wrap">
        {/* Toolbar */}
        <div className="table-toolbar">
          <div className="table-search">
            <Search size={14} />
            <input
              type="text"
              placeholder="Buscar por usuário, entidade ou ação…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <span className="aud-result-count">{totalFiltered} resultados</span>
        </div>

        {/* Filter strip (inside table-wrap) */}
        <div className="aud-filter-strip">
          {[
            ['todos',  'Todos'],
            ['hoje',   'Hoje'],
            ['LOGIN',  'LOGIN'],
            ['INSERT', 'INSERT'],
            ['UPDATE', 'UPDATE'],
            ['DELETE', 'DELETE'],
          ].map(([id, label]) => (
            <button
              key={id}
              type="button"
              className={`aud-filter-chip${quickFilter === id ? ' active' : ''}`}
              onClick={() => setQuickFilter(id)}
            >
              {label} <span>{filterCounts[id] ?? 0}</span>
            </button>
          ))}
        </div>

        {/* Table */}
        <div className="aud-table-scroll">
          <table className="aud-table">
            <thead>
              <tr>
                <th>ID Registro</th>
                <th>Data / Hora</th>
                <th>Usuário</th>
                <th>Ação</th>
                <th>Severidade</th>
                <th>Entidade</th>
                <th>Detalhe</th>
                <th>IP</th>
                <th>Hash</th>
              </tr>
            </thead>
            <tbody>
              {loading
                ? Array.from({ length: 8 }).map((_, i) => <SkeletonRow key={i} />)
                : pageData.length === 0
                  ? (
                    <tr><td colSpan={9}>
                      <div className="empty-state">
                        <div className="empty-icon empty-icon-animated"><Shield size={24} /></div>
                        <div className="empty-title">Nenhum registro encontrado</div>
                        <div className="empty-sub">{quickFilter !== 'todos' ? 'Tente outro filtro.' : 'Sem registros para o período.'}</div>
                      </div>
                    </td></tr>
                  )
                  : pageData.map((l, i) => {
                    const acao = (l.acao || l.operacao || '').toUpperCase()
                    const cfg  = ACAO_CFG[acao] || { icon: Shield, color: 'var(--color-text-secondary)', bg: 'var(--color-bg-muted)' }
                    const sev  = getSeverity(acao)
                    const detalhe = l.detalhe || l.observacao || l.valor_novo || l.valor_anterior

                    return (
                      <tr
                        key={l.id || i}
                        className="aud-row"
                        onClick={() => setSelectedLog(l)}
                      >
                        <td style={{ fontFamily: '"IBM Plex Mono",monospace', fontSize: 10.5, color: 'var(--color-brand-700)', fontWeight: 500 }}>
                          {l.id}
                        </td>
                        <td style={{ fontFamily: '"IBM Plex Mono",monospace', fontSize: 11 }}>
                          {fmtDT(l.data_hora || l.criado_em)}
                        </td>
                        <td style={{ fontSize: 12, fontWeight: 500 }}>{l.usuario_nome || l.usuario || '—'}</td>
                        <td>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 10.5, fontWeight: 700, padding: '2px 7px', borderRadius: 999, background: cfg.bg, color: cfg.color, letterSpacing: '0.04em' }}>
                            <cfg.icon size={10} />{acao}
                          </span>
                        </td>
                        <td>
                          <span style={{ display: 'inline-flex', alignItems: 'center', height: 22, padding: '0 8px', borderRadius: 999, border: `1px solid ${sev.border}`, background: sev.bg, color: sev.color, fontSize: 11, fontWeight: 800 }}>
                            {sev.label}
                          </span>
                        </td>
                        <td style={{ fontFamily: '"IBM Plex Mono",monospace', fontSize: 11 }}>{l.entidade || l.tabela_afetada || l.recurso || '—'}</td>
                        <td style={{ fontSize: 12, color: 'var(--color-text-secondary)', maxWidth: 180 }}>
                          <span style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {detalhe || '—'}
                          </span>
                        </td>
                        <td style={{ fontFamily: '"IBM Plex Mono",monospace', fontSize: 11, color: 'var(--color-text-tertiary)' }}>
                          {l.ip || l.ip_usuario || '—'}
                        </td>
                        <td onClick={e => e.stopPropagation()}>
                          {l.hash
                            ? (
                              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                <span
                                  title={l.hash}
                                  style={{ fontFamily: '"IBM Plex Mono",monospace', fontSize: 11, color: 'var(--color-brand-600)', fontWeight: 600 }}
                                >
                                  {l.hash.slice(0, 8)}
                                </span>
                                <button
                                  type="button"
                                  aria-label="Copiar hash"
                                  className="aud-copy-btn"
                                  onClick={e => copyHash(l.hash, e)}
                                >
                                  <Copy size={12} />
                                </button>
                              </div>
                            )
                            : <span style={{ color: 'var(--color-text-tertiary)', fontSize: 11 }}>—</span>
                          }
                        </td>
                      </tr>
                    )
                  })
              }
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="pagination">
          <span className="pagination-info">
            {totalFiltered === 0
              ? 'Sem resultados'
              : `Exibindo ${fromIdx}–${toIdx} de ${totalFiltered} registros`}
          </span>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <button
              className="pagination-btn"
              disabled={page === 0}
              onClick={() => setPage(p => Math.max(0, p - 1))}
              aria-label="Página anterior"
            >
              ‹
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
              ›
            </button>
          </div>
        </div>
      </div>

      {/* Drawer */}
      {selectedLog && (() => {
        const acao   = (selectedLog.acao || selectedLog.operacao || '').toUpperCase()
        const cfg    = ACAO_CFG[acao] || { icon: Shield, color: 'var(--color-text-secondary)', bg: 'var(--color-bg-muted)' }
        const sev    = getSeverity(acao)
        const raw    = selectedLog.detalhe || selectedLog.observacao || selectedLog.valor_novo || selectedLog.valor_anterior || ''
        const display = formatDetalhe(raw)
        const Icon   = cfg.icon

        return (
          <div
            className="aud-drawer-layer"
            onMouseDown={e => { if (e.target === e.currentTarget) setSelectedLog(null) }}
          >
            <aside className="aud-drawer" role="dialog" aria-label="Detalhes do log de auditoria">
              <div className="aud-drawer-header">
                <div>
                  <div className="aud-drawer-eyebrow">Log de Auditoria</div>
                  <span style={{ display: 'inline-flex', alignItems: 'center', height: 22, padding: '0 8px', borderRadius: 999, border: `1px solid ${sev.border}`, background: sev.bg, color: sev.color, fontSize: 11, fontWeight: 800, marginBottom: 6 }}>
                    {sev.label}
                  </span>
                  <h2>#{selectedLog.id}</h2>
                </div>
                <button className="icon-btn" onClick={() => setSelectedLog(null)} aria-label="Fechar">
                  <X size={15} />
                </button>
              </div>

              <div className="aud-drawer-body">
                {/* Identificação */}
                <div className="aud-drawer-section">Identificação</div>
                {[
                  ['ID Registro', selectedLog.id],
                  ['Data / Hora', fmtDT(selectedLog.data_hora || selectedLog.criado_em)],
                  ['Usuário',     selectedLog.usuario_nome || selectedLog.usuario || '—'],
                  ['IP',          selectedLog.ip || selectedLog.ip_usuario || '—'],
                ].map(([label, value]) => (
                  <div key={label} className="aud-drawer-row">
                    <span>{label}</span><strong>{value}</strong>
                  </div>
                ))}

                {/* Operação */}
                <div className="aud-drawer-section" style={{ marginTop: 18, paddingTop: 14, borderTop: '1px solid var(--color-border-default)' }}>Operação</div>
                <div className="aud-drawer-row">
                  <span>Ação</span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 10.5, fontWeight: 700, padding: '2px 7px', borderRadius: 999, background: cfg.bg, color: cfg.color, letterSpacing: '0.04em' }}>
                    <Icon size={10} />{acao}
                  </span>
                </div>
                {[
                  ['Entidade',   selectedLog.entidade || selectedLog.tabela_afetada || selectedLog.recurso || '—'],
                  ['Severidade', sev.label],
                ].map(([label, value]) => (
                  <div key={label} className="aud-drawer-row">
                    <span>{label}</span><strong>{value}</strong>
                  </div>
                ))}

                {/* Payload */}
                <div className="aud-drawer-section" style={{ marginTop: 18, paddingTop: 14, borderTop: '1px solid var(--color-border-default)' }}>Payload</div>
                <div style={{ background: 'var(--color-bg-muted)', border: '1px solid var(--color-border-muted)', borderRadius: 'var(--radius-md)', padding: '10px 12px', overflow: 'auto', maxHeight: 200 }}>
                  <code style={{ fontFamily: '"IBM Plex Mono",monospace', fontSize: 11, color: 'var(--color-text-primary)', whiteSpace: 'pre-wrap', wordBreak: 'break-word', display: 'block' }}>
                    {display || '—'}
                  </code>
                </div>

                {/* Integridade */}
                <div className="aud-drawer-section" style={{ marginTop: 18, paddingTop: 14, borderTop: '1px solid var(--color-border-default)' }}>Integridade</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', background: 'var(--color-success-50)', border: '1px solid var(--color-success-200)', borderRadius: 'var(--radius-md)', fontSize: 12, color: 'var(--color-success-700)', marginBottom: 10 }}>
                  <ShieldCheck size={14} style={{ flexShrink: 0 }} />
                  <span>Log imutável · retenção 7 anos · hash SHA-256</span>
                </div>
                {selectedLog.hash && (
                  <>
                    <div style={{ fontFamily: '"IBM Plex Mono",monospace', fontSize: 11, color: 'var(--color-text-primary)', padding: '8px 0', wordBreak: 'break-all', borderBottom: '1px solid var(--color-border-muted)', marginBottom: 10 }}>
                      {selectedLog.hash}
                    </div>
                    <button
                      type="button"
                      className="btn btn-outline btn-sm"
                      onClick={() => copyHash(selectedLog.hash)}
                    >
                      <Copy size={13} /> Copiar hash
                    </button>
                  </>
                )}
              </div>
            </aside>
          </div>
        )
      })()}

      <style>{`
        @keyframes aud-drawer-in { from{opacity:0;transform:translateX(16px)} to{opacity:1;transform:translateX(0)} }

        /* KPI Strip */
        .aud-kpi-grid { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:12px; margin-bottom:16px }
        .aud-kpi-card { display:flex; align-items:center; gap:12px; min-height:74px; padding:12px 14px; background:var(--color-bg-default); border:1px solid var(--color-border-default); border-radius:var(--radius-md); box-shadow:var(--shadow-xs) }
        .aud-kpi-icon { width:30px; height:30px; display:grid; place-items:center; background:var(--color-bg-subtle); border:1px solid var(--color-border-muted); border-radius:var(--radius-sm); flex-shrink:0 }
        .aud-kpi-label { font-size:10px; font-weight:700; color:var(--color-text-tertiary); text-transform:uppercase; letter-spacing:0.08em }
        .aud-kpi-value { margin-top:2px; font-size:26px; line-height:1; font-weight:800; color:var(--color-text-primary); font-variant-numeric:tabular-nums }

        /* Table */
        .aud-result-count { margin-left:auto; font-size:12px; color:var(--color-text-tertiary); white-space:nowrap }
        .aud-filter-strip { display:flex; gap:8px; padding:10px 20px; border-bottom:1px solid var(--color-border-default); background:var(--color-bg-elevated); flex-wrap:wrap }
        .aud-filter-chip { display:inline-flex; align-items:center; gap:6px; height:28px; padding:0 10px; border:1px solid var(--color-border-default); border-radius:6px; background:var(--color-bg-default); color:var(--color-text-secondary); font-size:12px; font-weight:700; cursor:pointer; transition:background 100ms,border-color 100ms,color 100ms; font-family:"IBM Plex Mono",monospace }
        .aud-filter-chip span { color:var(--color-text-tertiary); font-variant-numeric:tabular-nums }
        .aud-filter-chip:hover,.aud-filter-chip.active { background:var(--color-bg-subtle); border-color:var(--color-border-strong); color:var(--color-text-primary) }
        .aud-table-scroll { overflow-x:auto; max-height:calc(100vh - 420px) }
        .aud-table thead th { position:sticky; top:0; z-index:2; background:var(--color-bg-elevated) }
        .aud-row { cursor:pointer; transition:background 80ms }
        .aud-row:hover { background:var(--color-bg-subtle) }

        /* Hash copy button */
        .aud-copy-btn { display:grid; place-items:center; width:20px; height:20px; border-radius:4px; color:var(--color-text-tertiary); transition:background 80ms,color 80ms }
        .aud-copy-btn:hover { background:var(--color-bg-subtle); color:var(--color-text-primary) }

        /* Drawer */
        .aud-drawer-layer { position:fixed; inset:0; z-index:30; display:flex; justify-content:flex-end; background:transparent }
        .aud-drawer { width:min(500px,100%); height:100%; background:var(--color-bg-default); border-left:1px solid var(--color-border-default); box-shadow:var(--shadow-lg); animation:aud-drawer-in 160ms ease-out; display:flex; flex-direction:column }
        .aud-drawer-header { display:flex; justify-content:space-between; gap:16px; padding:20px; border-bottom:1px solid var(--color-border-default); background:var(--color-bg-elevated) }
        .aud-drawer-eyebrow { color:var(--color-text-tertiary); font-size:10px; font-weight:800; letter-spacing:0.08em; text-transform:uppercase; margin-bottom:6px }
        .aud-drawer h2 { margin:6px 0 0; color:var(--color-text-primary); font-family:"IBM Plex Mono",monospace; font-size:20px }
        .aud-drawer-body { flex:1; overflow:auto; padding:16px 20px }
        .aud-drawer-section { font-size:11px; font-weight:800; text-transform:uppercase; letter-spacing:0.07em; color:var(--color-text-tertiary); margin-bottom:8px }
        .aud-drawer-row { display:flex; justify-content:space-between; gap:16px; padding:10px 0; border-bottom:1px solid var(--color-border-muted); font-size:13px }
        .aud-drawer-row span { color:var(--color-text-tertiary); flex-shrink:0 }
        .aud-drawer-row strong { color:var(--color-text-primary); font-weight:700; text-align:right; word-break:break-word }

        @media(max-width:1180px) { .aud-kpi-grid{grid-template-columns:repeat(2,minmax(0,1fr))} }
        @media(max-width:700px)  { .aud-kpi-grid{grid-template-columns:1fr} .aud-table-scroll{max-height:none} }
      `}</style>
    </Layout>
  )
}

