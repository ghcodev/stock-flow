import { useMemo, useState, useEffect } from 'react'
import Layout from '../components/Layout.jsx'
import { useToast } from '../context/ToastContext.jsx'
import api from '../api/axios.js'
import {
  Plus, Download, Search, Eye, Lock, ScanLine, Layers,
  AlertTriangle, MoreVertical, Clock, ShieldCheck, ArrowUp,
  ArrowDown, X, Activity, Unlock,
} from 'lucide-react'

function StatusBadge({ status }) {
  const map = {
    'ativo':    { cls: 'badge-success', label: 'Ativo' },
    'vencendo': { cls: 'badge-warning', label: 'Vencendo' },
    'vencido':  { cls: 'badge-danger',  label: 'Vencido' },
    'bloqueado':{ cls: 'badge-neutral', label: 'Bloqueado' },
  }
  const key = status?.toLowerCase()
  const cfg = map[key] || { cls: 'badge-neutral', label: status || '—' }
  return <span className={`badge ${cfg.cls}`}>{cfg.label}</span>
}

function SkeletonRow() {
  return (
    <tr>
      {Array.from({ length: 10 }).map((_, i) => (
        <td key={i}><div className="skeleton" style={{ height: 14 }} /></td>
      ))}
    </tr>
  )
}

function KpiCard({ icon: Icon, label, value, tone }) {
  const color = {
    brand: 'var(--color-brand-600)',
    danger: 'var(--color-danger-600)',
    warning: 'var(--color-warning-600)',
    info: 'var(--color-info-600)',
  }[tone] || 'var(--color-text-secondary)'

  return (
    <div className="lotes-kpi-card">
      <div className="lotes-kpi-icon" style={{ color }}><Icon size={16} /></div>
      <div>
        <div className="lotes-kpi-label">{label}</div>
        <div className="lotes-kpi-value">{value}</div>
      </div>
    </div>
  )
}

function fmtLoc(l) {
  if (!l) return '—'
  if (l.corredor && l.nivel && l.posicao) return `${l.corredor}-N${l.nivel}-P${l.posicao}`
  return l.localizacao_nome || l.localizacao || '—'
}

function getLoteCode(l) {
  return l.numero_lote || l.codigo || l.id
}

function getRfid(l) {
  return l.rfid || l.codigo_identificacao || l.identificacao?.codigo || l.identificacao_codigo
}

function getStatus(l) {
  return l.status_lote || l.status
}

function isBlocked(l) {
  return getStatus(l)?.toLowerCase() === 'bloqueado'
}

function isQuarantine(l) {
  return getStatus(l)?.toLowerCase() === 'quarentena'
}

function hasRfid(l) {
  return Boolean(getRfid(l))
}

function getExpiryTone(dias) {
  if (dias == null) return 'neutral'
  if (dias < 0 || dias <= 7) return 'danger'
  if (dias <= 30) return 'warning'
  return 'success'
}

function getHealthScore(l) {
  if (isBlocked(l)) return 20
  const dias = Number(l.dias_para_vencer)
  let score = 100
  if (Number.isFinite(dias)) {
    if (dias < 0) score -= 70
    else if (dias <= 7) score -= 45
    else if (dias <= 30) score -= 20
  }
  if (Number(l.quantidade || 0) <= 0) score -= 20
  if (!hasRfid(l)) score -= 10
  return Math.max(0, Math.min(100, score))
}

function getHealthTone(score) {
  if (score >= 90) return 'success'
  if (score >= 70) return 'warning'
  return 'danger'
}

function formatDate(value) {
  return value ? new Date(value).toLocaleDateString('pt-BR') : '-'
}

function formatRemainingDays(dias) {
  if (dias == null) return '-'
  if (dias < 0) return 'Vencido'
  if (dias === 0) return 'Hoje'
  return `${dias} dias`
}

function HealthScore({ score }) {
  const tone = getHealthTone(score)
  return <span className={`lote-health lote-health-${tone}`}>{score}</span>
}

export default function Lotes() {
  const toast = useToast()
  const [lotes, setLotes] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [quickFilter, setQuickFilter] = useState('todos')
  const [sort, setSort] = useState({ key: 'validade', dir: 'asc' })
  const [selectedLote, setSelectedLote] = useState(null)
  const [openMenuId, setOpenMenuId] = useState(null)
  const [timeline, setTimeline] = useState([])
  const [timelineLoading, setTimelineLoading] = useState(false)

  useEffect(() => { load() }, [])

  useEffect(() => {
    function onKeyDown(e) {
      if (e.key === 'Escape') {
        setSelectedLote(null)
        setOpenMenuId(null)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  async function load() {
    setLoading(true)
    try {
      const { data } = await api.get('/lotes', { params: { limit: 500 } })
      setLotes(data.data || [])
      setTotal(data.total || 0)
    } catch {
      toast.error('Erro ao carregar lotes.')
    } finally {
      setLoading(false)
    }
  }

  async function openDrawer(lote) {
    setSelectedLote(lote)
    setOpenMenuId(null)
    setTimeline([])
    setTimelineLoading(true)
    try {
      const { data } = await api.get(`/lotes/${lote.id}/timeline`)
      setTimeline(Array.isArray(data) ? data.slice(0, 6) : [])
    } catch {
      setTimeline([])
    } finally {
      setTimelineLoading(false)
    }
  }

  function handleBlockAction() {
    toast.info('Bloqueio e desbloqueio exigem motivo/autorizacao no fluxo administrativo.')
    setOpenMenuId(null)
  }

  const enrichedLotes = useMemo(() => lotes.map(l => ({
    ...l,
    loteCode: getLoteCode(l),
    rfidCode: getRfid(l),
    statusValue: getStatus(l),
    locLabel: fmtLoc(l),
    healthScore: getHealthScore(l),
  })), [lotes])

  const kpis = useMemo(() => ({
    ativos: enrichedLotes.filter(l => getStatus(l)?.toLowerCase() === 'ativo').length,
    vencendo30: enrichedLotes.filter(l => l.dias_para_vencer != null && l.dias_para_vencer >= 0 && l.dias_para_vencer <= 30).length,
    bloqueados: enrichedLotes.filter(isBlocked).length,
    rfidHoje: '-',
  }), [enrichedLotes])

  const filterCounts = useMemo(() => ({
    todos: enrichedLotes.length,
    vence7: enrichedLotes.filter(l => l.dias_para_vencer != null && l.dias_para_vencer >= 0 && l.dias_para_vencer <= 7).length,
    vence30: enrichedLotes.filter(l => l.dias_para_vencer != null && l.dias_para_vencer >= 0 && l.dias_para_vencer <= 30).length,
    bloqueados: enrichedLotes.filter(isBlocked).length,
    quarentena: enrichedLotes.filter(isQuarantine).length,
    sem_rfid: enrichedLotes.filter(l => !hasRfid(l)).length,
  }), [enrichedLotes])

  const filteredLotes = useMemo(() => {
    const q = search.trim().toLowerCase()
    const byFilter = enrichedLotes.filter(l => {
      if (quickFilter === 'vence7') return l.dias_para_vencer != null && l.dias_para_vencer >= 0 && l.dias_para_vencer <= 7
      if (quickFilter === 'vence30') return l.dias_para_vencer != null && l.dias_para_vencer >= 0 && l.dias_para_vencer <= 30
      if (quickFilter === 'bloqueados') return isBlocked(l)
      if (quickFilter === 'quarentena') return isQuarantine(l)
      if (quickFilter === 'sem_rfid') return !hasRfid(l)
      return true
    })

    const bySearch = byFilter.filter(l => {
      if (!q) return true
      return [l.loteCode, l.produto_nome, l.rfidCode, l.locLabel, l.statusValue]
        .some(value => String(value || '').toLowerCase().includes(q))
    })

    const dir = sort.dir === 'asc' ? 1 : -1
    return [...bySearch].sort((a, b) => {
      const values = {
        lote: [a.loteCode || '', b.loteCode || ''],
        produto: [a.produto_nome || '', b.produto_nome || ''],
        validade: [a.dias_para_vencer ?? 99999, b.dias_para_vencer ?? 99999],
        quantidade: [Number(a.quantidade || 0), Number(b.quantidade || 0)],
        status: [a.statusValue || '', b.statusValue || ''],
      }[sort.key] || ['', '']
      const [av, bv] = values
      if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * dir
      return String(av).localeCompare(String(bv), 'pt-BR') * dir
    })
  }, [enrichedLotes, quickFilter, search, sort])

  function changeSort(key) {
    setSort(current => current.key === key
      ? { key, dir: current.dir === 'asc' ? 'desc' : 'asc' }
      : { key, dir: 'asc' })
  }

  function renderSortIcon(key) {
    if (sort.key !== key) return null
    return sort.dir === 'asc' ? <ArrowUp size={11} /> : <ArrowDown size={11} />
  }

  return (
    <Layout breadcrumb={['Operação', 'Lotes']}>
      <div className="page-header">
        <div className="page-header-left">
          <h1>Lotes</h1>
          <div className="subtitle">
            Central inteligente de lotes e rastreabilidade
          </div>
        </div>
        <div className="page-header-actions">
          <button className="btn btn-outline btn-sm"><Download size={14} /> Exportar</button>
          <button className="btn btn-outline btn-sm"><ScanLine size={14} /> Ler RFID</button>
          <button className="btn btn-primary"><Plus size={14} /> Registrar lote</button>
        </div>
      </div>

      <div className="lotes-kpi-grid">
        <KpiCard icon={Layers} label="Lotes Ativos" value={kpis.ativos} tone="brand" />
        <KpiCard icon={AlertTriangle} label="Vencendo 30d" value={kpis.vencendo30} tone="warning" />
        <KpiCard icon={Lock} label="Bloqueados" value={kpis.bloqueados} tone="danger" />
        <KpiCard icon={ScanLine} label="RFID Lidos Hoje" value={kpis.rfidHoje} tone="info" />
      </div>

      <div className="table-wrap">
        <div className="table-toolbar">
          <div className="table-search">
            <Search size={14} />
            <input type="text" placeholder="Buscar por lote, RFID, produto, status ou localizacao..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <div className="lotes-result-count">{filteredLotes.length} resultados</div>
        </div>

        <div className="lotes-filter-strip">
          {[
            ['todos', 'Todos'],
            ['vence7', 'Vence em 7 dias'],
            ['vence30', 'Vence em 30 dias'],
            ['bloqueados', 'Bloqueados'],
            ['quarentena', 'Quarentena'],
            ['sem_rfid', 'Sem RFID'],
          ].map(([id, label]) => (
            <button key={id} type="button" className={`lotes-filter-chip${quickFilter === id ? ' active' : ''}`} onClick={() => setQuickFilter(id)}>
              {label} <span>{filterCounts[id]}</span>
            </button>
          ))}
        </div>

        <div className="lotes-table-scroll">
        <table className="lotes-table">
          <thead>
            <tr>
              <th><button className="sort-th" onClick={() => changeSort('lote')}>Lote {renderSortIcon('lote')}</button></th>
              <th><button className="sort-th" onClick={() => changeSort('produto')}>Produto {renderSortIcon('produto')}</button></th>
              <th>Fabricacao</th>
              <th><button className="sort-th" onClick={() => changeSort('validade')}>Validade {renderSortIcon('validade')}</button></th>
              <th style={{ textAlign: 'right' }}><button className="sort-th sort-th-right" onClick={() => changeSort('quantidade')}>Qtd {renderSortIcon('quantidade')}</button></th>
              <th>Saude</th>
              <th>RFID</th>
              <th>Localizacao</th>
              <th style={{ textAlign: 'center' }}><button className="sort-th" onClick={() => changeSort('status')}>Status {renderSortIcon('status')}</button></th>
              <th style={{ textAlign: 'right' }}>Acoes</th>
            </tr>
          </thead>
          <tbody>
            {loading
              ? Array.from({ length: 6 }).map((_, i) => <SkeletonRow key={i} />)
              : filteredLotes.length === 0
                ? (
                  <tr>
                    <td colSpan={10}>
                      <div className="empty-state">
                        <div className="empty-icon empty-icon-animated"><Layers size={24} /></div>
                        <div className="empty-title">Nenhum lote encontrado</div>
                        <div className="empty-sub">{search ? 'Tente outro termo de busca.' : 'Nenhum lote cadastrado.'}</div>
                      </div>
                    </td>
                  </tr>
                )
                : filteredLotes.map(l => {
                  const dias = l.dias_para_vencer
                  const tone = getExpiryTone(dias)
                  const blocked = isBlocked(l)
                  return (
                    <tr key={l.id} className={tone === 'danger' ? 'lote-row-danger' : tone === 'warning' ? 'lote-row-warning' : ''}>
                      <td style={{ fontFamily: '"IBM Plex Mono",monospace', fontSize: 12, fontWeight: 700 }}>
                        <button type="button" className="lote-code-button" onClick={() => openDrawer(l)}>{l.loteCode}</button>
                      </td>
                      <td>
                        <div style={{ fontWeight: 600 }}>{l.produto_nome || '-'}</div>
                        {l.produto_codigo && <div style={{ fontSize: 11, color: 'var(--color-text-tertiary)' }}>{l.produto_codigo}</div>}
                      </td>
                      <td style={{ fontFamily: '"IBM Plex Mono",monospace', fontSize: 12 }}>
                        {formatDate(l.data_fabricacao)}
                      </td>
                      <td>
                        <div className={`validity-block validity-${tone}`}>
                          <div className="validity-days">{formatRemainingDays(dias)}</div>
                          <div className="validity-date">{formatDate(l.data_validade)}</div>
                        </div>
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{l.quantidade ?? '-'}</td>
                      <td><HealthScore score={l.healthScore} /></td>
                      <td>
                        {l.rfidCode ? <button type="button" className="rfid-chip" title={l.rfidCode}>RFID</button> : <span style={{ color: 'var(--color-text-tertiary)', fontSize: 12 }}>-</span>}
                      </td>
                      <td style={{ fontFamily: '"IBM Plex Mono",monospace', fontSize: 12, color: 'var(--color-brand-700)', fontWeight: 500 }}>{l.locLabel}</td>
                      <td style={{ textAlign: 'center' }}><StatusBadge status={l.statusValue} /></td>
                      <td style={{ textAlign: 'right' }}>
                        <div className="lote-actions">
                          <button className="icon-btn" aria-label="Acoes" onClick={() => setOpenMenuId(openMenuId === l.id ? null : l.id)}><MoreVertical size={14} /></button>
                          {openMenuId === l.id && (
                            <div className="lote-actions-menu">
                              <button type="button" onClick={() => openDrawer(l)}><Eye size={13} /> Visualizar</button>
                              <a href={`/rastreabilidade?lote=${l.id}`}><ShieldCheck size={13} /> Rastreabilidade</a>
                              <button type="button" onClick={handleBlockAction}><Lock size={13} /> {blocked ? 'Desbloquear' : 'Bloquear'}</button>
                              <a href={`/historico?lote=${l.id}`}><Clock size={13} /> Historico</a>
                              <a href={`/movimentacoes?lote=${l.id}`}><Activity size={13} /> Movimentacoes</a>
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
          <span className="pagination-info">Exibindo {filteredLotes.length} de {total} lotes</span>
        </div>
      </div>

      {selectedLote && (
        <div className="lote-drawer-layer" onMouseDown={e => { if (e.target === e.currentTarget) setSelectedLote(null) }}>
          <aside className="lote-drawer" role="dialog" aria-label="Detalhes do lote">
            <div className="lote-drawer-header">
              <div>
                <div className="lote-drawer-eyebrow">Lote</div>
                <h2>{selectedLote.loteCode}</h2>
                <div className="lote-drawer-product">{selectedLote.produto_nome || '-'}</div>
              </div>
              <button className="icon-btn" onClick={() => setSelectedLote(null)} aria-label="Fechar"><X size={15} /></button>
            </div>
            <div className="lote-drawer-body">
              <div className="lote-drawer-section">
                {[
                  ['Produto', selectedLote.produto_nome || '-'],
                  ['Quantidade', selectedLote.quantidade ?? '-'],
                  ['Validade', formatDate(selectedLote.data_validade)],
                  ['Restam', formatRemainingDays(selectedLote.dias_para_vencer)],
                  ['Localizacao', selectedLote.locLabel],
                  ['RFID', selectedLote.rfidCode || '-'],
                  ['Status', selectedLote.statusValue || '-'],
                  ['Health Score', selectedLote.healthScore],
                ].map(([label, value]) => (
                  <div key={label} className="lote-drawer-row">
                    <span>{label}</span>
                    <strong>{value}</strong>
                  </div>
                ))}
              </div>

              <div className="lote-timeline">
                <div className="lote-timeline-title">Timeline operacional</div>
                {timelineLoading ? (
                  <div className="lote-timeline-empty">Carregando timeline...</div>
                ) : timeline.length === 0 ? (
                  <div className="lote-timeline-empty">Sem movimentacoes registradas.</div>
                ) : timeline.map(item => (
                  <div key={item.id} className="lote-timeline-item">
                    <span>{formatDate(item.data_movimentacao)}</span>
                    <strong>{item.tipo || 'Movimentacao'}</strong>
                    <small>{item.usuario_nome || '-'}</small>
                  </div>
                ))}
              </div>
            </div>
            <div className="lote-drawer-actions">
              <a className="btn btn-primary" href={`/rastreabilidade?lote=${selectedLote.id}`}>Ver rastreabilidade</a>
              <a className="btn btn-outline" href={`/movimentacoes?lote=${selectedLote.id}`}>Movimentacoes</a>
              <button className="btn btn-outline" type="button" onClick={handleBlockAction}>{isBlocked(selectedLote) ? <Unlock size={14} /> : <Lock size={14} />}{isBlocked(selectedLote) ? 'Desbloquear' : 'Bloquear'}</button>
            </div>
          </aside>
        </div>
      )}
      <style>{`
        @keyframes drawerIn { from{opacity:0;transform:translateX(16px)} to{opacity:1;transform:translateX(0)} }
        .lotes-kpi-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 12px;
          margin-bottom: 16px;
        }
        .lotes-kpi-card {
          display: flex;
          align-items: center;
          gap: 12px;
          min-height: 74px;
          padding: 12px 14px;
          background: var(--color-bg-default);
          border: 1px solid var(--color-border-default);
          border-radius: var(--radius-md);
          box-shadow: var(--shadow-xs);
        }
        .lotes-kpi-icon {
          width: 30px;
          height: 30px;
          display: grid;
          place-items: center;
          background: var(--color-bg-subtle);
          border: 1px solid var(--color-border-muted);
          border-radius: var(--radius-sm);
          flex-shrink: 0;
        }
        .lotes-kpi-label {
          font-size: 10px;
          font-weight: 700;
          color: var(--color-text-tertiary);
          text-transform: uppercase;
          letter-spacing: 0.08em;
        }
        .lotes-kpi-value {
          margin-top: 2px;
          font-size: 26px;
          line-height: 1;
          font-weight: 800;
          color: var(--color-text-primary);
          font-variant-numeric: tabular-nums;
        }
        .lotes-result-count {
          margin-left: auto;
          color: var(--color-text-tertiary);
          font-size: 12px;
          white-space: nowrap;
        }
        .lotes-filter-strip {
          display: flex;
          gap: 8px;
          padding: 10px 20px;
          border-bottom: 1px solid var(--color-border-default);
          background: var(--color-bg-elevated);
          flex-wrap: wrap;
        }
        .lotes-filter-chip {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          height: 28px;
          padding: 0 10px;
          border: 1px solid var(--color-border-default);
          border-radius: 6px;
          background: var(--color-bg-default);
          color: var(--color-text-secondary);
          font-size: 12px;
          font-weight: 700;
          cursor: pointer;
          transition: background 100ms, border-color 100ms, color 100ms;
        }
        .lotes-filter-chip span {
          color: var(--color-text-tertiary);
          font-variant-numeric: tabular-nums;
        }
        .lotes-filter-chip:hover,
        .lotes-filter-chip.active {
          background: var(--color-bg-subtle);
          border-color: var(--color-border-strong);
          color: var(--color-text-primary);
        }
        .lotes-table-scroll {
          overflow: auto;
          max-height: calc(100vh - 330px);
        }
        .lotes-table thead th {
          position: sticky;
          top: 0;
          z-index: 2;
          background: var(--color-bg-elevated);
        }
        .lotes-table tbody tr {
          transition: background 100ms;
        }
        .lotes-table tbody tr:hover {
          background: var(--color-bg-subtle);
        }
        .lote-row-warning {
          box-shadow: inset 3px 0 0 var(--color-warning-600);
          background: var(--color-warning-50);
        }
        .lote-row-danger {
          box-shadow: inset 3px 0 0 var(--color-danger-600);
          background: var(--color-danger-50);
        }
        .sort-th {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          color: inherit;
          font: inherit;
          font-weight: 700;
          cursor: pointer;
        }
        .sort-th-right {
          justify-content: flex-end;
          width: 100%;
        }
        .lote-code-button {
          color: var(--color-brand-700);
          font: inherit;
          font-weight: 800;
          cursor: pointer;
        }
        .lote-code-button:hover {
          text-decoration: underline;
        }
        .validity-block {
          display: inline-flex;
          flex-direction: column;
          gap: 2px;
        }
        .validity-days {
          display: inline-flex;
          align-items: center;
          font-size: 12px;
          font-weight: 800;
          font-variant-numeric: tabular-nums;
        }
        .validity-date {
          color: var(--color-text-tertiary);
          font-size: 11px;
          font-family: "IBM Plex Mono", monospace;
        }
        .validity-danger .validity-days { color: var(--color-danger-700); }
        .validity-warning .validity-days { color: var(--color-warning-700); }
        .validity-success .validity-days { color: var(--color-success-700); }
        .lote-health {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-width: 34px;
          height: 22px;
          border-radius: var(--radius-full);
          font-size: 12px;
          font-weight: 800;
          font-variant-numeric: tabular-nums;
          border: 1px solid var(--color-border-default);
        }
        .lote-health-success {
          color: var(--color-success-700);
          background: var(--color-success-50);
          border-color: var(--color-success-200);
        }
        .lote-health-warning {
          color: var(--color-warning-700);
          background: var(--color-warning-50);
          border-color: var(--color-warning-200);
        }
        .lote-health-danger {
          color: var(--color-danger-700);
          background: var(--color-danger-50);
          border-color: var(--color-danger-200);
        }
        .rfid-chip {
          display: inline-flex;
          align-items: center;
          height: 22px;
          padding: 0 8px;
          border: 1px solid var(--color-info-100);
          border-radius: var(--radius-full);
          background: var(--color-info-50);
          color: var(--color-info-700);
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 0.08em;
        }
        .lote-actions {
          position: relative;
          display: inline-flex;
          justify-content: flex-end;
        }
        .lote-actions-menu {
          position: absolute;
          right: 0;
          top: 34px;
          z-index: 4;
          min-width: 188px;
          padding: 6px;
          background: var(--color-bg-default);
          border: 1px solid var(--color-border-default);
          border-radius: var(--radius-md);
          box-shadow: var(--shadow-md);
        }
        .lote-actions-menu a,
        .lote-actions-menu button {
          width: 100%;
          display: flex;
          align-items: center;
          gap: 8px;
          min-height: 30px;
          padding: 0 8px;
          border-radius: 5px;
          color: var(--color-text-secondary);
          font-size: 12px;
          font-weight: 600;
          text-align: left;
          text-decoration: none;
        }
        .lote-actions-menu a:hover,
        .lote-actions-menu button:hover {
          background: var(--color-bg-subtle);
          color: var(--color-text-primary);
        }
        .lote-drawer-layer {
          position: fixed;
          inset: 0;
          z-index: 30;
          display: flex;
          justify-content: flex-end;
          background: transparent;
        }
        .lote-drawer {
          width: min(480px, 100%);
          height: 100%;
          background: var(--color-bg-default);
          border-left: 1px solid var(--color-border-default);
          box-shadow: var(--shadow-lg);
          animation: drawerIn 160ms ease-out;
          display: flex;
          flex-direction: column;
        }
        .lote-drawer-header {
          display: flex;
          justify-content: space-between;
          gap: 16px;
          padding: 20px;
          border-bottom: 1px solid var(--color-border-default);
          background: var(--color-bg-elevated);
        }
        .lote-drawer-eyebrow {
          color: var(--color-text-tertiary);
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }
        .lote-drawer h2 {
          margin: 4px 0 0;
          color: var(--color-text-primary);
          font-family: "IBM Plex Mono", monospace;
          font-size: 20px;
        }
        .lote-drawer-product {
          margin-top: 4px;
          color: var(--color-text-secondary);
          font-size: 13px;
          font-weight: 600;
        }
        .lote-drawer-body {
          flex: 1;
          overflow: auto;
          padding: 16px 20px;
        }
        .lote-drawer-row {
          display: flex;
          justify-content: space-between;
          gap: 16px;
          padding: 10px 0;
          border-bottom: 1px solid var(--color-border-muted);
          font-size: 13px;
        }
        .lote-drawer-row span {
          color: var(--color-text-tertiary);
        }
        .lote-drawer-row strong {
          color: var(--color-text-primary);
          text-align: right;
          font-weight: 700;
        }
        .lote-timeline {
          margin-top: 18px;
          padding-top: 14px;
          border-top: 1px solid var(--color-border-default);
        }
        .lote-timeline-title {
          margin-bottom: 10px;
          color: var(--color-text-secondary);
          font-size: 12px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.06em;
        }
        .lote-timeline-item {
          display: grid;
          grid-template-columns: 78px 1fr;
          gap: 4px 10px;
          padding: 9px 0;
          border-bottom: 1px solid var(--color-border-muted);
          font-size: 12px;
        }
        .lote-timeline-item span {
          color: var(--color-text-tertiary);
          font-family: "IBM Plex Mono", monospace;
        }
        .lote-timeline-item strong {
          color: var(--color-text-primary);
          text-transform: capitalize;
        }
        .lote-timeline-item small {
          grid-column: 2;
          color: var(--color-text-tertiary);
        }
        .lote-timeline-empty {
          color: var(--color-text-tertiary);
          font-size: 13px;
          padding: 16px 0;
        }
        .lote-drawer-actions {
          display: flex;
          gap: 8px;
          padding: 14px 20px;
          border-top: 1px solid var(--color-border-default);
          flex-wrap: wrap;
        }
        @media (max-width: 1180px) {
          .lotes-kpi-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        }
        @media (max-width: 700px) {
          .lotes-kpi-grid { grid-template-columns: 1fr; }
          .lotes-table-scroll { max-height: none; }
          .lote-drawer-actions .btn { width: 100%; justify-content: center; }
        }
      `}</style>
    </Layout>
  )
}

