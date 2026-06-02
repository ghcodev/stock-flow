import { useMemo, useState, useEffect, useRef } from 'react'
import Layout from '../components/Layout.jsx'
import RFIDModal from '../components/RFIDModal.jsx'
import { useToast } from '../context/ToastContext.jsx'
import api from '../api/axios.js'
import {
  Plus, Download, Search, ArrowDownLeft, ScanLine, CheckCircle,
  Clock, X, MoreVertical, AlertTriangle, Package, Users, Boxes,
  Activity, ArrowUp, ArrowDown, ShieldCheck,
} from 'lucide-react'

const StatusBadge = ({ s }) => {
  const map = { 'concluida': 'badge-success', 'conferida': 'badge-info', 'pendente': 'badge-warning' }
  const key = s?.toLowerCase().replace(/[^a-z]/g, '')
  return <span className={`badge ${map[key] || 'badge-neutral'}`}>{s}</span>
}

function SkeletonRow() {
  return (
    <tr>
      {Array.from({ length: 9 }).map((_, i) => (
        <td key={i}><div className="skeleton" style={{ height: 13 }} /></td>
      ))}
    </tr>
  )
}

function KpiCard({ icon: Icon, label, value, tone }) {
  const color = {
    brand: 'var(--color-brand-600)',
    success: 'var(--color-success-600)',
    warning: 'var(--color-warning-600)',
    info: 'var(--color-info-600)',
  }[tone] || 'var(--color-text-secondary)'

  return (
    <div className="entrada-kpi-card">
      <div className="entrada-kpi-icon" style={{ color }}><Icon size={16} /></div>
      <div>
        <div className="entrada-kpi-label">{label}</div>
        <div className="entrada-kpi-value">{value}</div>
      </div>
    </div>
  )
}

function getEntryId(m) {
  return m.id || m.id_movimentacao
}

function getEntryDate(m) {
  return m.data_movimentacao || m.criado_em
}

function getLoteCode(m) {
  return m.numero_lote || m.codigo_lote || m.id_lote
}

function getRfid(m) {
  return m.rfidCode || m.rfid || m.codigo_identificacao || m.identificacao_codigo
}

function formatDateTime(value) {
  return value ? new Date(value).toLocaleString('pt-BR') : '-'
}

function isToday(value) {
  if (!value) return false
  const d = new Date(value)
  const now = new Date()
  return d.toDateString() === now.toDateString()
}

function isThisWeek(value) {
  if (!value) return false
  const d = new Date(value)
  const now = new Date()
  const start = new Date(now)
  start.setDate(now.getDate() - 7)
  return d >= start && d <= now
}

function formatQuantity(value) {
  return Number(value || 0).toLocaleString('pt-BR')
}

export default function Entrada() {
  const toast = useToast()
  const [movs, setMovs] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [lotes, setLotes] = useState([])
  const [loteMap, setLoteMap] = useState({})
  const [form, setForm] = useState({ id_lote: '', quantidade: '' })
  const [rfidModalOpen, setRfidModalOpen] = useState(false)
  const [rfidOrigem, setRfidOrigem] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [quickFilter, setQuickFilter] = useState('todas')
  const [sort, setSort] = useState({ key: 'data', dir: 'desc' })
  const [selectedEntry, setSelectedEntry] = useState(null)
  const [openMenuId, setOpenMenuId] = useState(null)
  const [timeline, setTimeline] = useState([])
  const [timelineLoading, setTimelineLoading] = useState(false)

  useEffect(() => { load() }, [])

  useEffect(() => {
    function onKeyDown(e) {
      if (e.key === 'Escape') {
        setSelectedEntry(null)
        setOpenMenuId(null)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  async function load() {
    setLoading(true)
    try {
      const [movResp, lotesResp] = await Promise.all([
        api.get('/movimentacoes', { params: { tipo: 'entrada', limit: 500 } }),
        api.get('/lotes', { params: { limit: 500 } }),
      ])
      const data = movResp.data
      const items = (data.data || data || []).filter(m => m.tipo === 'entrada')
      const lotesRows = lotesResp.data.data || []
      setMovs(items)
      setLotes(lotesRows)
      setLoteMap(Object.fromEntries(lotesRows.map(l => [String(l.id), l])))
      setTotal(data.total || items.length)
    } catch {
      toast.error('Erro ao carregar entradas.')
    } finally {
      setLoading(false)
    }
  }

  async function openForm() {
    setShowForm(true)
    setForm({ id_lote: '', quantidade: '' })
    setRfidOrigem(null)
    if (lotes.length) return
    try { await load() } catch {}
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.id_lote || !form.quantidade) return
    setSubmitting(true)
    try {
      await api.post('/movimentacoes/entrada', {
        id_lote: Number(form.id_lote),
        quantidade: Number(form.quantidade),
        ...(rfidOrigem ? { observacao: `Origem: Leitura RFID manual | Codigo: ${rfidOrigem.codigo}` } : {}),
      })
      toast.success('Entrada registrada com sucesso!')
      setShowForm(false)
      load()
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erro ao registrar entrada.')
    } finally {
      setSubmitting(false)
    }
  }

  function fmtLoc(m) {
    if (m.localizacao_destino_nome) return m.localizacao_destino_nome
    if (m.localizacao_nome) return m.localizacao_nome
    if (m.destino_corredor && m.destino_nivel && m.destino_posicao) return `${m.destino_corredor}-N${m.destino_nivel}-P${m.destino_posicao}`
    return m.localizacao || ''
  }

  function getLoteForEntry(m) {
    return loteMap[String(m.id_lote)] || {}
  }

  function mergeRFIDLote(lote) {
    const id = String(lote.id_lote || lote.id)
    const row = {
      ...lote,
      id,
      codigo: lote.numero_lote || lote.codigo,
      numero_lote: lote.numero_lote || lote.codigo,
      produto_nome: lote.produto_nome,
    }
    setLotes(prev => prev.some(item => String(item.id) === id) ? prev : [row, ...prev])
    setLoteMap(prev => ({ ...prev, [id]: row }))
    return id
  }

  function handleRFIDConfirm(lote) {
    const id = mergeRFIDLote(lote)
    setShowForm(true)
    setForm(f => ({
      ...f,
      id_lote: id,
      quantidade: f.quantidade || '',
    }))
    setRfidOrigem({ codigo: lote.codigo_rfid || lote.codigo || lote.numero_lote })
    setRfidModalOpen(false)
    toast.success(`Lote ${lote.numero_lote || id} carregado via RFID`)
  }

  function getEntryLocation(m) {
    const current = fmtLoc(m)
    if (current) return current
    const lote = getLoteForEntry(m)
    if (lote.corredor && lote.nivel && lote.posicao) return `${lote.corredor}-N${lote.nivel}-P${lote.posicao}`
    return ''
  }

  function hasLocation(m) {
    return Boolean(getEntryLocation(m))
  }

  async function openDrawer(entry) {
    setSelectedEntry(entry)
    setOpenMenuId(null)
    setTimeline([])
    setTimelineLoading(true)
    try {
      const { data } = await api.get(`/lotes/${entry.id_lote}/timeline`)
      setTimeline(Array.isArray(data) ? data.slice(0, 6) : [])
    } catch {
      setTimeline([])
    } finally {
      setTimelineLoading(false)
    }
  }

  const enrichedMovs = useMemo(() => movs.map(m => {
    const lote = loteMap[String(m.id_lote)] || {}
    return {
      ...m,
      entryId: getEntryId(m),
      entryDate: getEntryDate(m),
      loteCode: getLoteCode(m),
      rfidCode: getRfid(lote) || getRfid(m),
      locationLabel: getEntryLocation(m),
      produtoNome: m.produto_nome || lote.produto_nome,
      hasDivergence: false,
    }
  }), [movs, loteMap])

  const kpis = useMemo(() => {
    const todayRows = enrichedMovs.filter(m => isToday(m.entryDate))
    return {
      hoje: todayRows.length,
      volume: todayRows.reduce((sum, m) => sum + Number(m.quantidade || 0), 0),
      operadores: new Set(todayRows.map(m => m.usuario_nome).filter(Boolean)).size,
      rfid: todayRows.filter(m => m.rfidCode).length,
    }
  }, [enrichedMovs])

  const filterCounts = useMemo(() => ({
    todas: enrichedMovs.length,
    hoje: enrichedMovs.filter(m => isToday(m.entryDate)).length,
    semana: enrichedMovs.filter(m => isThisWeek(m.entryDate)).length,
    rfid: enrichedMovs.filter(m => m.rfidCode).length,
    sem_localizacao: enrichedMovs.filter(m => !hasLocation(m)).length,
    divergencia: enrichedMovs.filter(m => m.hasDivergence).length,
  }), [enrichedMovs])

  const filteredMovs = useMemo(() => {
    const q = search.trim().toLowerCase()
    const byFilter = enrichedMovs.filter(m => {
      if (quickFilter === 'hoje') return isToday(m.entryDate)
      if (quickFilter === 'semana') return isThisWeek(m.entryDate)
      if (quickFilter === 'rfid') return Boolean(m.rfidCode)
      if (quickFilter === 'sem_localizacao') return !hasLocation(m)
      if (quickFilter === 'divergencia') return m.hasDivergence
      return true
    })

    const bySearch = byFilter.filter(m => {
      if (!q) return true
      return [m.entryId, m.loteCode, m.produtoNome, m.rfidCode, m.locationLabel, m.usuario_nome]
        .some(value => String(value || '').toLowerCase().includes(q))
    })

    const dir = sort.dir === 'asc' ? 1 : -1
    return [...bySearch].sort((a, b) => {
      const values = {
        data: [new Date(a.entryDate || 0).getTime(), new Date(b.entryDate || 0).getTime()],
        lote: [a.loteCode || '', b.loteCode || ''],
        produto: [a.produtoNome || '', b.produtoNome || ''],
        quantidade: [Number(a.quantidade || 0), Number(b.quantidade || 0)],
        operador: [a.usuario_nome || '', b.usuario_nome || ''],
      }[sort.key] || ['', '']
      const [av, bv] = values
      if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * dir
      return String(av).localeCompare(String(bv), 'pt-BR') * dir
    })
  }, [enrichedMovs, quickFilter, search, sort])

  const topOperadores = useMemo(() => {
    const map = new Map()
    enrichedMovs.forEach(m => {
      const key = m.usuario_nome || 'Operador'
      map.set(key, (map.get(key) || 0) + 1)
    })
    return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4)
  }, [enrichedMovs])

  const topProdutos = useMemo(() => {
    const map = new Map()
    enrichedMovs.forEach(m => {
      const key = m.produtoNome || '-'
      map.set(key, (map.get(key) || 0) + Number(m.quantidade || 0))
    })
    return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4)
  }, [enrichedMovs])

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
    <Layout breadcrumb={['Movimentações', 'Entrada']}>
      <div className="page-header">
        <div className="page-header-left">
          <h1>Entrada de Lotes</h1>
          <div className="subtitle">
            <span>Central de recebimento e entrada de estoque</span>
          </div>
        </div>
        <div className="page-header-actions">
          <button className="btn btn-outline btn-sm" onClick={() => setRfidModalOpen(true)}><ScanLine size={14} /> Ler RFID</button>
          <button className="btn btn-outline btn-sm"><Download size={14} /> Exportar</button>
          <button className="btn btn-primary" onClick={openForm}><Plus size={14} /> Nova entrada</button>
        </div>
      </div>

      <div className="entrada-kpi-grid">
        <KpiCard icon={ArrowDownLeft} label="Entradas Hoje" value={kpis.hoje} tone="brand" />
        <KpiCard icon={Boxes} label="Volume Recebido" value={formatQuantity(kpis.volume)} tone="success" />
        <KpiCard icon={Users} label="Operadores Ativos" value={kpis.operadores} tone="info" />
        <KpiCard icon={ScanLine} label="Entradas via RFID" value={kpis.rfid} tone="warning" />
      </div>

      <div className="entrada-insights-grid">
        <div className="entrada-insight-card">
          <div className="entrada-insight-title"><Users size={14} /> Top Operadores</div>
          {topOperadores.length === 0 ? <div className="entrada-insight-empty">Sem entradas no periodo.</div> : topOperadores.map(([nome, totalOperador]) => (
            <div key={nome} className="entrada-insight-row"><span>{nome}</span><strong>{totalOperador}</strong></div>
          ))}
        </div>
        <div className="entrada-insight-card">
          <div className="entrada-insight-title"><Package size={14} /> Produtos Mais Recebidos</div>
          {topProdutos.length === 0 ? <div className="entrada-insight-empty">Sem volume recebido.</div> : topProdutos.map(([produto, volume]) => (
            <div key={produto} className="entrada-insight-row"><span>{produto}</span><strong>{formatQuantity(volume)} un</strong></div>
          ))}
        </div>
      </div>

      <div className="table-wrap">
        <div className="table-toolbar">
          <div className="table-search">
            <Search size={14} />
            <input type="text" placeholder="Buscar entrada, lote, produto, RFID, operador ou localizacao..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <div className="entrada-result-count">{filteredMovs.length} resultados</div>
        </div>

        <div className="entrada-filter-strip">
          {[
            ['todas', 'Todas'],
            ['hoje', 'Hoje'],
            ['semana', 'Semana'],
            ['rfid', 'RFID'],
            ['sem_localizacao', 'Sem Localizacao'],
            ['divergencia', 'Divergencia'],
          ].map(([id, label]) => (
            <button key={id} type="button" className={`entrada-filter-chip${quickFilter === id ? ' active' : ''}`} onClick={() => setQuickFilter(id)}>
              {label} <span>{filterCounts[id]}</span>
            </button>
          ))}
        </div>

        <div className="entrada-table-scroll">
        <table className="entrada-table">
          <thead>
            <tr>
              <th>ID</th>
              <th><button className="sort-th" onClick={() => changeSort('data')}>Data / Hora {renderSortIcon('data')}</button></th>
              <th><button className="sort-th" onClick={() => changeSort('lote')}>Lote {renderSortIcon('lote')}</button></th>
              <th><button className="sort-th" onClick={() => changeSort('produto')}>Produto {renderSortIcon('produto')}</button></th>
              <th style={{ textAlign: 'right' }}><button className="sort-th sort-th-right" onClick={() => changeSort('quantidade')}>Qtd {renderSortIcon('quantidade')}</button></th>
              <th>RFID</th>
              <th>Localizacao</th>
              <th><button className="sort-th" onClick={() => changeSort('operador')}>Operador {renderSortIcon('operador')}</button></th>
              <th style={{ textAlign: 'right' }}>Acoes</th>
            </tr>
          </thead>
          <tbody>
            {loading
              ? Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)
              : filteredMovs.length === 0
                ? (
                  <tr><td colSpan={9}>
                    <div className="empty-state">
                      <div className="empty-icon empty-icon-animated"><ArrowDownLeft size={24} /></div>
                      <div className="empty-title">Nenhuma entrada encontrada</div>
                      <div className="empty-sub">Registre a primeira entrada de lote.</div>
                    </div>
                  </td></tr>
                )
                : filteredMovs.map((m, i) => {
                  const missingLocation = !hasLocation(m)
                  return (
                    <tr key={m.entryId || i} className={missingLocation ? 'entrada-row-warning' : ''}>
                      <td style={{ fontFamily: '"IBM Plex Mono",monospace', fontSize: 11, color: 'var(--color-brand-700)', fontWeight: 600 }}>
                        <button type="button" className="entrada-id-button" onClick={() => openDrawer(m)}>{m.entryId}</button>
                      </td>
                      <td style={{ fontFamily: '"IBM Plex Mono",monospace', fontSize: 11 }}>{formatDateTime(m.entryDate)}</td>
                      <td style={{ fontFamily: '"IBM Plex Mono",monospace', fontSize: 11 }}>{m.loteCode}</td>
                      <td style={{ fontWeight: 600 }}>{m.produtoNome || '-'}</td>
                      <td style={{ textAlign: 'right' }}><span className="entrada-qty">+{formatQuantity(m.quantidade)} un</span></td>
                      <td>{m.rfidCode ? <span className="entrada-rfid" title={m.rfidCode}>RFID</span> : <span style={{ color: 'var(--color-text-tertiary)', fontSize: 12 }}>-</span>}</td>
                      <td style={{ fontFamily: '"IBM Plex Mono",monospace', fontSize: 11, color: missingLocation ? 'var(--color-warning-700)' : 'var(--color-brand-700)' }}>
                        {missingLocation ? <span className="entrada-location-warning"><AlertTriangle size={12} /> Sem localizacao</span> : m.locationLabel}
                      </td>
                      <td style={{ fontSize: 12 }}>{m.usuario_nome || '-'}</td>
                      <td style={{ textAlign: 'right' }}>
                        <div className="entrada-actions">
                          <button className="icon-btn" aria-label="Acoes" onClick={() => setOpenMenuId(openMenuId === m.entryId ? null : m.entryId)}><MoreVertical size={14} /></button>
                          {openMenuId === m.entryId && (
                            <div className="entrada-actions-menu">
                              <button type="button" onClick={() => openDrawer(m)}><Activity size={13} /> Visualizar</button>
                              <a href={`/rastreabilidade?lote=${m.id_lote}`}><ShieldCheck size={13} /> Rastreabilidade</a>
                              <a href={`/movimentacoes?lote=${m.id_lote}`}><Clock size={13} /> Movimentacoes</a>
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
          <span className="pagination-info">Exibindo {filteredMovs.length} de {total} entradas</span>
        </div>
      </div>

      {selectedEntry && (
        <div className="entrada-drawer-layer" onMouseDown={e => { if (e.target === e.currentTarget) setSelectedEntry(null) }}>
          <aside className="entrada-drawer" role="dialog" aria-label="Detalhes da entrada">
            <div className="entrada-drawer-header">
              <div>
                <div className="entrada-drawer-eyebrow">Entrada</div>
                <h2>#{selectedEntry.entryId}</h2>
                <div className="entrada-drawer-subtitle">{selectedEntry.produtoNome || '-'}</div>
              </div>
              <button className="icon-btn" onClick={() => setSelectedEntry(null)} aria-label="Fechar"><X size={15} /></button>
            </div>
            <div className="entrada-drawer-body">
              {[
                ['Data / Hora', formatDateTime(selectedEntry.entryDate)],
                ['Lote', selectedEntry.loteCode || '-'],
                ['Produto', selectedEntry.produtoNome || '-'],
                ['Quantidade', `${formatQuantity(selectedEntry.quantidade)} un`],
                ['RFID', selectedEntry.rfidCode || '-'],
                ['Localizacao', selectedEntry.locationLabel || 'Sem localizacao'],
                ['Operador', selectedEntry.usuario_nome || '-'],
                ['Status', selectedEntry.status || 'concluida'],
              ].map(([label, value]) => (
                <div key={label} className="entrada-drawer-row"><span>{label}</span><strong>{value}</strong></div>
              ))}
              <div className="entrada-timeline">
                <div className="entrada-timeline-title">Timeline operacional</div>
                {timelineLoading ? <div className="entrada-timeline-empty">Carregando timeline...</div> : timeline.length === 0 ? (
                  <div className="entrada-timeline-empty">Sem eventos registrados.</div>
                ) : timeline.map(item => (
                  <div key={item.id} className="entrada-timeline-item">
                    <span>{formatDateTime(item.data_movimentacao)}</span>
                    <strong>{item.tipo || 'Movimentacao'}</strong>
                    <small>{item.usuario_nome || '-'}</small>
                  </div>
                ))}
              </div>
            </div>
            <div className="entrada-drawer-actions">
              <a className="btn btn-primary" href={`/rastreabilidade?lote=${selectedEntry.id_lote}`}>Rastreabilidade</a>
              <a className="btn btn-outline" href={`/movimentacoes?lote=${selectedEntry.id_lote}`}>Movimentacoes</a>
            </div>
          </aside>
        </div>
      )}

      {showForm && (
        <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && setShowForm(false)}>
          <div className="modal">
            <div className="modal-header">
              <h3 className="modal-title">Nova Entrada de Lote</h3>
              <button className="icon-btn" onClick={() => setShowForm(false)}><X size={16} /></button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Lote *</label>
                  <select className="select" value={form.id_lote} onChange={e => setForm(f => ({ ...f, id_lote: e.target.value }))} required>
                    <option value="">Selecionar lote…</option>
                    {lotes.map(l => (
                      <option key={l.id} value={l.id}>{l.codigo || l.id} — {l.produto_nome || '—'}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Quantidade *</label>
                  <input className="input" type="number" min="1" placeholder="0"
                    value={form.quantidade} onChange={e => setForm(f => ({ ...f, quantidade: e.target.value }))} required />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={() => setShowForm(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting
                    ? <><span style={{ width: 13, height: 13, border: '2px solid var(--color-border-muted)', borderTopColor: 'var(--color-text-inverse)', borderRadius: '50%', animation: 'spin 0.65s linear infinite', display: 'inline-block' }} /> Registrando…</>
                    : <><CheckCircle size={14} /> Registrar entrada</>
                  }
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      <RFIDModal
        isOpen={rfidModalOpen}
        onClose={() => setRfidModalOpen(false)}
        onConfirm={handleRFIDConfirm}
        mode="entrada"
      />
      <style>{`
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes drawerIn{from{opacity:0;transform:translateX(16px)}to{opacity:1;transform:translateX(0)}}
        .entrada-kpi-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin-bottom:16px}
        .entrada-kpi-card{display:flex;align-items:center;gap:12px;min-height:74px;padding:12px 14px;background:var(--color-bg-default);border:1px solid var(--color-border-default);border-radius:var(--radius-md);box-shadow:var(--shadow-xs)}
        .entrada-kpi-icon{width:30px;height:30px;display:grid;place-items:center;background:var(--color-bg-subtle);border:1px solid var(--color-border-muted);border-radius:var(--radius-sm);flex-shrink:0}
        .entrada-kpi-label{font-size:10px;font-weight:700;color:var(--color-text-tertiary);text-transform:uppercase;letter-spacing:0.08em}
        .entrada-kpi-value{margin-top:2px;font-size:26px;line-height:1;font-weight:800;color:var(--color-text-primary);font-variant-numeric:tabular-nums}
        .entrada-insights-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin-bottom:16px}
        .entrada-insight-card{background:var(--color-bg-default);border:1px solid var(--color-border-default);border-radius:var(--radius-md);box-shadow:var(--shadow-xs);padding:12px 14px}
        .entrada-insight-title{display:flex;align-items:center;gap:6px;color:var(--color-text-secondary);font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:8px}
        .entrada-insight-row{display:flex;justify-content:space-between;gap:12px;padding:7px 0;border-top:1px solid var(--color-border-muted);font-size:12px}
        .entrada-insight-row span{color:var(--color-text-secondary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
        .entrada-insight-row strong{color:var(--color-text-primary);font-variant-numeric:tabular-nums;white-space:nowrap}
        .entrada-insight-empty,.entrada-result-count{color:var(--color-text-tertiary);font-size:12px}
        .entrada-result-count{margin-left:auto;white-space:nowrap}
        .entrada-filter-strip{display:flex;gap:8px;padding:10px 20px;border-bottom:1px solid var(--color-border-default);background:var(--color-bg-elevated);flex-wrap:wrap}
        .entrada-filter-chip{display:inline-flex;align-items:center;gap:6px;height:28px;padding:0 10px;border:1px solid var(--color-border-default);border-radius:6px;background:var(--color-bg-default);color:var(--color-text-secondary);font-size:12px;font-weight:700;cursor:pointer;transition:background 100ms,border-color 100ms,color 100ms}
        .entrada-filter-chip span{color:var(--color-text-tertiary);font-variant-numeric:tabular-nums}
        .entrada-filter-chip:hover,.entrada-filter-chip.active{background:var(--color-bg-subtle);border-color:var(--color-border-strong);color:var(--color-text-primary)}
        .entrada-table-scroll{overflow:auto;max-height:calc(100vh - 390px)}
        .entrada-table thead th{position:sticky;top:0;z-index:2;background:var(--color-bg-elevated)}
        .entrada-table tbody tr{transition:background 100ms}
        .entrada-table tbody tr:hover{background:var(--color-bg-subtle)}
        .entrada-row-warning{box-shadow:inset 3px 0 0 var(--color-warning-600);background:var(--color-warning-50)}
        .sort-th{display:inline-flex;align-items:center;gap:4px;color:inherit;font:inherit;font-weight:700;cursor:pointer}
        .sort-th-right{justify-content:flex-end;width:100%}
        .entrada-id-button{color:var(--color-brand-700);font:inherit;font-weight:800;cursor:pointer}
        .entrada-id-button:hover{text-decoration:underline}
        .entrada-qty{display:inline-flex;align-items:center;height:24px;padding:0 8px;border-radius:var(--radius-full);background:var(--color-success-50);border:1px solid var(--color-success-200);color:var(--color-success-700);font-weight:800;font-variant-numeric:tabular-nums}
        .entrada-rfid{display:inline-flex;align-items:center;height:22px;padding:0 8px;border:1px solid var(--color-info-100);border-radius:var(--radius-full);background:var(--color-info-50);color:var(--color-info-700);font-size:10px;font-weight:800;letter-spacing:0.08em}
        .entrada-location-warning{display:inline-flex;align-items:center;gap:4px;font-weight:800}
        .entrada-actions{position:relative;display:inline-flex;justify-content:flex-end}
        .entrada-actions-menu{position:absolute;right:0;top:34px;z-index:4;min-width:178px;padding:6px;background:var(--color-bg-default);border:1px solid var(--color-border-default);border-radius:var(--radius-md);box-shadow:var(--shadow-md)}
        .entrada-actions-menu a,.entrada-actions-menu button{width:100%;display:flex;align-items:center;gap:8px;min-height:30px;padding:0 8px;border-radius:5px;color:var(--color-text-secondary);font-size:12px;font-weight:600;text-align:left;text-decoration:none}
        .entrada-actions-menu a:hover,.entrada-actions-menu button:hover{background:var(--color-bg-subtle);color:var(--color-text-primary)}
        .entrada-drawer-layer{position:fixed;inset:0;z-index:30;display:flex;justify-content:flex-end;background:transparent}
        .entrada-drawer{width:min(480px,100%);height:100%;background:var(--color-bg-default);border-left:1px solid var(--color-border-default);box-shadow:var(--shadow-lg);animation:drawerIn 160ms ease-out;display:flex;flex-direction:column}
        .entrada-drawer-header{display:flex;justify-content:space-between;gap:16px;padding:20px;border-bottom:1px solid var(--color-border-default);background:var(--color-bg-elevated)}
        .entrada-drawer-eyebrow{color:var(--color-text-tertiary);font-size:10px;font-weight:800;letter-spacing:0.08em;text-transform:uppercase}
        .entrada-drawer h2{margin:4px 0 0;color:var(--color-text-primary);font-family:"IBM Plex Mono",monospace;font-size:20px}
        .entrada-drawer-subtitle{margin-top:4px;color:var(--color-text-secondary);font-size:13px;font-weight:600}
        .entrada-drawer-body{flex:1;overflow:auto;padding:16px 20px}
        .entrada-drawer-row{display:flex;justify-content:space-between;gap:16px;padding:10px 0;border-bottom:1px solid var(--color-border-muted);font-size:13px}
        .entrada-drawer-row span{color:var(--color-text-tertiary)}
        .entrada-drawer-row strong{color:var(--color-text-primary);text-align:right;font-weight:700}
        .entrada-timeline{margin-top:18px;padding-top:14px;border-top:1px solid var(--color-border-default)}
        .entrada-timeline-title{margin-bottom:10px;color:var(--color-text-secondary);font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:0.06em}
        .entrada-timeline-item{display:grid;grid-template-columns:120px 1fr;gap:4px 10px;padding:9px 0;border-bottom:1px solid var(--color-border-muted);font-size:12px}
        .entrada-timeline-item span{color:var(--color-text-tertiary);font-family:"IBM Plex Mono",monospace}
        .entrada-timeline-item strong{color:var(--color-text-primary);text-transform:capitalize}
        .entrada-timeline-item small{grid-column:2;color:var(--color-text-tertiary)}
        .entrada-timeline-empty{color:var(--color-text-tertiary);font-size:13px;padding:16px 0}
        .entrada-drawer-actions{display:flex;gap:8px;padding:14px 20px;border-top:1px solid var(--color-border-default);flex-wrap:wrap}
        @media (max-width:1180px){.entrada-kpi-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.entrada-insights-grid{grid-template-columns:1fr}}
        @media (max-width:700px){.entrada-kpi-grid{grid-template-columns:1fr}.entrada-table-scroll{max-height:none}.entrada-drawer-actions .btn{width:100%;justify-content:center}}
      `}</style>
    </Layout>
  )
}

