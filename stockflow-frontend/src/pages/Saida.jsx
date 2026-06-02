import { useMemo, useState, useEffect } from 'react'
import Layout from '../components/Layout.jsx'
import RFIDModal from '../components/RFIDModal.jsx'
import { useToast } from '../context/ToastContext.jsx'
import api from '../api/axios.js'
import {
  Plus, Download, Search, ArrowUpRight, ScanLine, CheckCircle,
  X, AlertTriangle, MoreVertical, Package, Users, Boxes,
  Activity, ArrowUp, ArrowDown, ShieldCheck, Clock, MapPin,
} from 'lucide-react'

function SkeletonRow() {
  return (
    <tr>
      {Array.from({ length: 10 }).map((_, i) => (
        <td key={i}>
          <div className="skeleton" style={{ height: 13, borderRadius: 'var(--radius-xs)' }} />
        </td>
      ))}
    </tr>
  )
}

function KpiCard({ icon: Icon, label, value, tone }) {
  const color = {
    brand: 'var(--color-brand-600)',
    danger: 'var(--color-danger-600)',
    success: 'var(--color-success-600)',
    info: 'var(--color-info-600)',
  }[tone] || 'var(--color-text-secondary)'

  return (
    <div className="saida-kpi-card">
      <div className="saida-kpi-icon" style={{ color }}><Icon size={16} /></div>
      <div>
        <div className="saida-kpi-label">{label}</div>
        <div className="saida-kpi-value">{value}</div>
      </div>
    </div>
  )
}

function getExitId(m) {
  return m.id || m.id_movimentacao
}

function getExitDate(m) {
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

function getDestination(m) {
  return m.destino || m.localizacao_destino_nome || m.observacao || m.motivo || m.motivo_movimentacao || ''
}

function getImpact(quantity, threshold) {
  const value = Number(quantity || 0)
  if (value >= threshold) return { label: 'Alto', cls: 'saida-impact-high' }
  if (value > 0) return { label: 'Normal', cls: 'saida-impact-normal' }
  return { label: '-', cls: 'saida-impact-neutral' }
}

export default function Saida() {
  const toast = useToast()
  const [movs, setMovs] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [lotes, setLotes] = useState([])
  const [loteMap, setLoteMap] = useState({})
  const [form, setForm] = useState({ id_lote: '', quantidade: '', destino: '', motivo: 'Requisicao medica' })
  const [rfidModalOpen, setRfidModalOpen] = useState(false)
  const [rfidOrigem, setRfidOrigem] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [formErr, setFormErr] = useState('')
  const [quickFilter, setQuickFilter] = useState('todas')
  const [sort, setSort] = useState({ key: 'data', dir: 'desc' })
  const [selectedExit, setSelectedExit] = useState(null)
  const [openMenuId, setOpenMenuId] = useState(null)
  const [timeline, setTimeline] = useState([])
  const [timelineLoading, setTimelineLoading] = useState(false)

  useEffect(() => { load() }, [])

  useEffect(() => {
    function onKeyDown(e) {
      if (e.key === 'Escape') {
        setSelectedExit(null)
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
        api.get('/movimentacoes', { params: { tipo: 'saida', limit: 500 } }),
        api.get('/lotes', { params: { limit: 500 } }),
      ])
      const data = movResp.data
      const items = (data.data || data || []).filter(m => m.tipo === 'saida')
      const lotesRows = lotesResp.data.data || []
      setMovs(items)
      setLotes(lotesRows)
      setLoteMap(Object.fromEntries(lotesRows.map(l => [String(l.id), l])))
      setTotal(items.length)
    } catch {
      toast.error('Erro ao carregar saidas.')
    } finally {
      setLoading(false)
    }
  }

  async function openForm() {
    setShowForm(true)
    setForm({ id_lote: '', quantidade: '', destino: '', motivo: 'Requisicao medica' })
    setRfidOrigem(null)
    setFormErr('')
    if (lotes.length) return
    try { await load() } catch {}
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.id_lote || !form.quantidade || !form.destino) return
    setSubmitting(true)
    setFormErr('')
    try {
      await api.post('/movimentacoes/saida', {
        id_lote: Number(form.id_lote),
        quantidade: Number(form.quantidade),
        destino: form.destino,
        motivo: form.motivo,
        ...(rfidOrigem ? { observacao: `Origem: Leitura RFID manual | Codigo: ${rfidOrigem.codigo}` } : {}),
      })
      toast.success('Saida registrada com sucesso!')
      setShowForm(false)
      load()
    } catch (err) {
      const e = err.response?.data
      if (e?.codigo === 'RN11') {
        setFormErr(e.error || 'Quantidade insuficiente no lote.')
      } else {
        toast.error(e?.error || 'Erro ao registrar saida.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  function getLoteForExit(m) {
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
    setFormErr('')
    setRfidOrigem({ codigo: lote.codigo_rfid || lote.codigo || lote.numero_lote })
    setRfidModalOpen(false)
    toast.success(`Lote ${lote.numero_lote || id} carregado via RFID`)
  }

  function getExitDestination(m) {
    const destination = getDestination(m)
    if (destination) return destination
    const lote = getLoteForExit(m)
    if (lote.localizacao_nome) return lote.localizacao_nome
    if (lote.corredor && lote.nivel && lote.posicao) return `${lote.corredor}-N${lote.nivel}-P${lote.posicao}`
    if (m.localizacao_origem_nome) return m.localizacao_origem_nome
    if (m.localizacao_nome) return m.localizacao_nome
    return ''
  }

  function hasPedido(m) {
    return [m.pedido, m.numero_pedido, m.destino, m.observacao, m.motivo, m.motivo_movimentacao]
      .some(value => String(value || '').toLowerCase().includes('pedido'))
  }

  async function openDrawer(exit) {
    setSelectedExit(exit)
    setOpenMenuId(null)
    setTimeline([])
    setTimelineLoading(true)
    try {
      const { data } = await api.get(`/lotes/${exit.id_lote}/timeline`)
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
      exitId: getExitId(m),
      exitDate: getExitDate(m),
      loteCode: getLoteCode(m),
      rfidCode: getRfid(lote) || getRfid(m),
      destinationLabel: getExitDestination(m),
      produtoNome: m.produto_nome || lote.produto_nome,
      pedidoFlag: hasPedido(m),
    }
  }), [movs, loteMap])

  const highVolumeThreshold = useMemo(() => {
    const quantities = enrichedMovs.map(m => Number(m.quantidade || 0)).filter(Boolean)
    if (!quantities.length) return Number.POSITIVE_INFINITY
    const average = quantities.reduce((sum, value) => sum + value, 0) / quantities.length
    return Math.max(100, Math.ceil(average * 1.5))
  }, [enrichedMovs])

  const kpis = useMemo(() => {
    const todayRows = enrichedMovs.filter(m => isToday(m.exitDate))
    return {
      hoje: todayRows.length,
      volume: todayRows.reduce((sum, m) => sum + Number(m.quantidade || 0), 0),
      produtos: new Set(todayRows.map(m => m.produtoNome).filter(Boolean)).size,
      operadores: new Set(todayRows.map(m => m.usuario_nome).filter(Boolean)).size,
    }
  }, [enrichedMovs])

  const filterCounts = useMemo(() => ({
    todas: enrichedMovs.length,
    hoje: enrichedMovs.filter(m => isToday(m.exitDate)).length,
    semana: enrichedMovs.filter(m => isThisWeek(m.exitDate)).length,
    alto_volume: enrichedMovs.filter(m => Number(m.quantidade || 0) >= highVolumeThreshold).length,
    rfid: enrichedMovs.filter(m => m.rfidCode).length,
    pedidos: enrichedMovs.filter(m => m.pedidoFlag).length,
  }), [enrichedMovs, highVolumeThreshold])

  const filteredMovs = useMemo(() => {
    const q = search.trim().toLowerCase()
    const byFilter = enrichedMovs.filter(m => {
      if (quickFilter === 'hoje') return isToday(m.exitDate)
      if (quickFilter === 'semana') return isThisWeek(m.exitDate)
      if (quickFilter === 'alto_volume') return Number(m.quantidade || 0) >= highVolumeThreshold
      if (quickFilter === 'rfid') return Boolean(m.rfidCode)
      if (quickFilter === 'pedidos') return m.pedidoFlag
      return true
    })

    const bySearch = byFilter.filter(m => {
      if (!q) return true
      return [m.exitId, m.loteCode, m.produtoNome, m.rfidCode, m.destinationLabel, m.usuario_nome, m.observacao]
        .some(value => String(value || '').toLowerCase().includes(q))
    })

    const dir = sort.dir === 'asc' ? 1 : -1
    return [...bySearch].sort((a, b) => {
      const values = {
        data: [new Date(a.exitDate || 0).getTime(), new Date(b.exitDate || 0).getTime()],
        lote: [a.loteCode || '', b.loteCode || ''],
        produto: [a.produtoNome || '', b.produtoNome || ''],
        quantidade: [Number(a.quantidade || 0), Number(b.quantidade || 0)],
        destino: [a.destinationLabel || '', b.destinationLabel || ''],
        operador: [a.usuario_nome || '', b.usuario_nome || ''],
      }[sort.key] || ['', '']
      const [av, bv] = values
      if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * dir
      return String(av).localeCompare(String(bv), 'pt-BR') * dir
    })
  }, [enrichedMovs, quickFilter, search, sort, highVolumeThreshold])

  const topProdutos = useMemo(() => {
    const map = new Map()
    enrichedMovs.forEach(m => {
      const key = m.produtoNome || '-'
      map.set(key, (map.get(key) || 0) + Number(m.quantidade || 0))
    })
    return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4)
  }, [enrichedMovs])

  const topOperadores = useMemo(() => {
    const map = new Map()
    enrichedMovs.forEach(m => {
      const key = m.usuario_nome || 'Operador'
      map.set(key, (map.get(key) || 0) + 1)
    })
    return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4)
  }, [enrichedMovs])

  const topDestinos = useMemo(() => {
    const map = new Map()
    enrichedMovs.forEach(m => {
      const key = m.destinationLabel || 'Destino nao informado'
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
    <Layout breadcrumb={['Movimentacoes', 'Saida']}>
      <div className="page-header">
        <div className="page-header-left">
          <h1>Saida de Lotes</h1>
          <div className="subtitle">
            <span>Central de expedicao e consumo de estoque</span>
          </div>
        </div>
        <div className="page-header-actions">
          <button className="btn btn-outline btn-sm" onClick={() => setRfidModalOpen(true)}><ScanLine size={14} /> Ler RFID</button>
          <button className="btn btn-outline btn-sm"><Download size={14} /> Exportar</button>
          <button className="btn btn-primary" onClick={openForm}><Plus size={14} /> Registrar saida</button>
        </div>
      </div>

      <div className="saida-kpi-grid">
        <KpiCard icon={ArrowUpRight} label="Saidas Hoje" value={kpis.hoje} tone="brand" />
        <KpiCard icon={Boxes} label="Volume Expedido" value={formatQuantity(kpis.volume)} tone="danger" />
        <KpiCard icon={Package} label="Produtos Movimentados" value={kpis.produtos} tone="success" />
        <KpiCard icon={Users} label="Operadores Ativos" value={kpis.operadores} tone="info" />
      </div>

      <div className="saida-insights-grid">
        <div className="saida-insight-card">
          <div className="saida-insight-title"><Package size={14} /> Top Produtos Expedidos</div>
          {topProdutos.length === 0 ? <div className="saida-insight-empty">Sem volume expedido.</div> : topProdutos.map(([produto, volume]) => (
            <div key={produto} className="saida-insight-row"><span>{produto}</span><strong>{formatQuantity(volume)} un</strong></div>
          ))}
        </div>
        <div className="saida-insight-card">
          <div className="saida-insight-title"><Users size={14} /> Top Operadores</div>
          {topOperadores.length === 0 ? <div className="saida-insight-empty">Sem saidas no periodo.</div> : topOperadores.map(([nome, totalOperador]) => (
            <div key={nome} className="saida-insight-row"><span>{nome}</span><strong>{totalOperador}</strong></div>
          ))}
        </div>
        <div className="saida-insight-card">
          <div className="saida-insight-title"><MapPin size={14} /> Top Destinos</div>
          {topDestinos.length === 0 ? <div className="saida-insight-empty">Sem destinos registrados.</div> : topDestinos.map(([destino, volume]) => (
            <div key={destino} className="saida-insight-row"><span>{destino}</span><strong>{formatQuantity(volume)} un</strong></div>
          ))}
        </div>
      </div>

      <div className="table-wrap">
        <div className="table-toolbar">
          <div className="table-search">
            <Search size={14} />
            <input type="text" placeholder="Buscar saida, lote, produto, RFID, operador ou destino..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <div className="saida-result-count">{filteredMovs.length} resultados</div>
        </div>

        <div className="saida-filter-strip">
          {[
            ['todas', 'Todas'],
            ['hoje', 'Hoje'],
            ['semana', 'Semana'],
            ['alto_volume', 'Alto Volume'],
            ['rfid', 'RFID'],
            ['pedidos', 'Pedidos'],
          ].map(([id, label]) => (
            <button key={id} type="button" className={`saida-filter-chip${quickFilter === id ? ' active' : ''}`} onClick={() => setQuickFilter(id)}>
              {label} <span>{filterCounts[id]}</span>
            </button>
          ))}
        </div>

        <div className="saida-table-scroll">
        <table className="saida-table">
          <thead>
            <tr>
              <th>ID</th>
              <th><button className="sort-th" onClick={() => changeSort('data')}>Data / Hora {renderSortIcon('data')}</button></th>
              <th><button className="sort-th" onClick={() => changeSort('lote')}>Lote {renderSortIcon('lote')}</button></th>
              <th><button className="sort-th" onClick={() => changeSort('produto')}>Produto {renderSortIcon('produto')}</button></th>
              <th style={{ textAlign: 'right' }}><button className="sort-th sort-th-right" onClick={() => changeSort('quantidade')}>Qtd {renderSortIcon('quantidade')}</button></th>
              <th>Impacto</th>
              <th>RFID</th>
              <th><button className="sort-th" onClick={() => changeSort('destino')}>Destino {renderSortIcon('destino')}</button></th>
              <th><button className="sort-th" onClick={() => changeSort('operador')}>Operador {renderSortIcon('operador')}</button></th>
              <th style={{ textAlign: 'right' }}>Acoes</th>
            </tr>
          </thead>
          <tbody>
            {loading
              ? Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)
              : filteredMovs.length === 0
                ? (
                  <tr><td colSpan={10}>
                    <div className="empty-state">
                      <div className="empty-icon empty-icon-animated"><ArrowUpRight size={24} /></div>
                      <div className="empty-title">Nenhuma saida encontrada</div>
                      <div className="empty-sub">{search ? 'Tente outro termo de busca.' : 'Registre a primeira saida de lote.'}</div>
                    </div>
                  </td></tr>
                )
                : filteredMovs.map((m, i) => {
                  const highVolume = Number(m.quantidade || 0) >= highVolumeThreshold
                  const impact = getImpact(m.quantidade, highVolumeThreshold)
                  return (
                    <tr key={m.exitId || i} className={highVolume ? 'saida-row-high' : ''}>
                      <td style={{ fontFamily: '"IBM Plex Mono",monospace', fontSize: 11, color: 'var(--color-brand-700)', fontWeight: 600 }}>
                        <button type="button" className="saida-id-button" onClick={() => openDrawer(m)}>{m.exitId}</button>
                      </td>
                      <td style={{ fontFamily: '"IBM Plex Mono",monospace', fontSize: 11 }}>{formatDateTime(m.exitDate)}</td>
                      <td style={{ fontFamily: '"IBM Plex Mono",monospace', fontSize: 11 }}>{m.loteCode}</td>
                      <td style={{ fontWeight: 600 }}>{m.produtoNome || '-'}</td>
                      <td style={{ textAlign: 'right' }}><span className="saida-qty">-{formatQuantity(m.quantidade)} un</span></td>
                      <td><span className={`saida-impact ${impact.cls}`}>{impact.label}</span></td>
                      <td>{m.rfidCode ? <span className="saida-rfid" title={m.rfidCode}>RFID</span> : <span style={{ color: 'var(--color-text-tertiary)', fontSize: 12 }}>-</span>}</td>
                      <td>
                        <div className="saida-destination">
                          <strong>{m.destinationLabel || 'Destino nao informado'}</strong>
                          {m.pedidoFlag && <span>Pedido</span>}
                        </div>
                      </td>
                      <td style={{ fontSize: 12 }}>{m.usuario_nome || '-'}</td>
                      <td style={{ textAlign: 'right' }}>
                        <div className="saida-actions">
                          <button className="icon-btn" aria-label="Acoes" onClick={() => setOpenMenuId(openMenuId === m.exitId ? null : m.exitId)}><MoreVertical size={14} /></button>
                          {openMenuId === m.exitId && (
                            <div className="saida-actions-menu">
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
          <span className="pagination-info">Exibindo {filteredMovs.length} de {total} saidas</span>
        </div>
      </div>

      {selectedExit && (
        <div className="saida-drawer-layer" onMouseDown={e => { if (e.target === e.currentTarget) setSelectedExit(null) }}>
          <aside className="saida-drawer" role="dialog" aria-label="Detalhes da saida">
            <div className="saida-drawer-header">
              <div>
                <div className="saida-drawer-eyebrow">Saida</div>
                <h2>#{selectedExit.exitId}</h2>
                <div className="saida-drawer-subtitle">{selectedExit.produtoNome || '-'}</div>
              </div>
              <button className="icon-btn" onClick={() => setSelectedExit(null)} aria-label="Fechar"><X size={15} /></button>
            </div>
            <div className="saida-drawer-body">
              {[
                ['Data / Hora', formatDateTime(selectedExit.exitDate)],
                ['Lote', selectedExit.loteCode || '-'],
                ['Produto', selectedExit.produtoNome || '-'],
                ['Quantidade', `${formatQuantity(selectedExit.quantidade)} un`],
                ['Impacto', getImpact(selectedExit.quantidade, highVolumeThreshold).label],
                ['RFID', selectedExit.rfidCode || '-'],
                ['Destino', selectedExit.destinationLabel || 'Destino nao informado'],
                ['Operador', selectedExit.usuario_nome || '-'],
                ['Status', selectedExit.status || 'concluida'],
              ].map(([label, value]) => (
                <div key={label} className="saida-drawer-row"><span>{label}</span><strong>{value}</strong></div>
              ))}
              <div className="saida-timeline">
                <div className="saida-timeline-title">Timeline operacional</div>
                {timelineLoading ? <div className="saida-timeline-empty">Carregando timeline...</div> : timeline.length === 0 ? (
                  <div className="saida-timeline-empty">Sem eventos registrados.</div>
                ) : timeline.map(item => (
                  <div key={item.id} className="saida-timeline-item">
                    <span>{formatDateTime(item.data_movimentacao)}</span>
                    <strong>{item.tipo || 'Movimentacao'}</strong>
                    <small>{item.usuario_nome || '-'}</small>
                  </div>
                ))}
              </div>
            </div>
            <div className="saida-drawer-actions">
              <a className="btn btn-primary" href={`/rastreabilidade?lote=${selectedExit.id_lote}`}>Rastreabilidade</a>
              <a className="btn btn-outline" href={`/movimentacoes?lote=${selectedExit.id_lote}`}>Movimentacoes</a>
            </div>
          </aside>
        </div>
      )}

      {showForm && (
        <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && setShowForm(false)}>
          <div className="modal">
            <div className="modal-header">
              <h3 className="modal-title">Registrar Saida</h3>
              <button className="icon-btn" onClick={() => setShowForm(false)}><X size={16} /></button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                {formErr && (
                  <div className="saida-form-error">
                    <AlertTriangle size={14} style={{ flexShrink: 0 }} /> {formErr}
                  </div>
                )}
                <div className="form-group">
                  <label className="form-label">Lote *</label>
                  <select className="select" value={form.id_lote} onChange={e => { setForm(f => ({ ...f, id_lote: e.target.value })); setFormErr('') }} required>
                    <option value="">Selecionar lote...</option>
                    {lotes.map(l => (
                      <option key={l.id} value={l.id}>{l.codigo || l.numero_lote || l.id} - {l.produto_nome || '-'} ({l.quantidade} un.)</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Destino *</label>
                  <select className="select" value={form.destino} onChange={e => setForm(f => ({ ...f, destino: e.target.value }))} required>
                    <option value="">Selecionar destino...</option>
                    {['Distribuidor Regional', 'Rede de Supermercados', 'Atacado', 'Cliente Direto', 'Ponto de Venda', 'E-commerce', 'Filial', 'Exportacao', 'Devolucao ao Fornecedor', 'Descarte Sanitario'].map(d => (
                      <option key={d}>{d}</option>
                    ))}
                  </select>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Quantidade *</label>
                    <input className="input" type="number" min="1" placeholder="0"
                      value={form.quantidade} onChange={e => { setForm(f => ({ ...f, quantidade: e.target.value })); setFormErr('') }} required />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Motivo</label>
                    <select className="select" value={form.motivo} onChange={e => setForm(f => ({ ...f, motivo: e.target.value }))}>
                      {['Venda', 'Distribuicao', 'Reposicao de Estoque', 'Picking para Expedicao', 'Descarte Sanitario', 'Devolucao ao Fornecedor'].map(m => <option key={m}>{m}</option>)}
                    </select>
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={() => setShowForm(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting
                    ? <><span style={{ width: 13, height: 13, border: '2px solid var(--color-border-muted)', borderTopColor: 'var(--color-text-inverse)', borderRadius: '50%', animation: 'spin 0.65s linear infinite', display: 'inline-block' }} /> Registrando...</>
                    : <><CheckCircle size={14} /> Confirmar saida</>
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
        mode="saida"
      />
      <style>{`
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes drawerIn{from{opacity:0;transform:translateX(16px)}to{opacity:1;transform:translateX(0)}}
        .saida-kpi-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin-bottom:16px}
        .saida-kpi-card{display:flex;align-items:center;gap:12px;min-height:74px;padding:12px 14px;background:var(--color-bg-default);border:1px solid var(--color-border-default);border-radius:var(--radius-md);box-shadow:var(--shadow-xs)}
        .saida-kpi-icon{width:30px;height:30px;display:grid;place-items:center;background:var(--color-bg-subtle);border:1px solid var(--color-border-muted);border-radius:var(--radius-sm);flex-shrink:0}
        .saida-kpi-label{font-size:10px;font-weight:700;color:var(--color-text-tertiary);text-transform:uppercase;letter-spacing:0.08em}
        .saida-kpi-value{margin-top:2px;font-size:26px;line-height:1;font-weight:800;color:var(--color-text-primary);font-variant-numeric:tabular-nums}
        .saida-insights-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;margin-bottom:16px}
        .saida-insight-card{background:var(--color-bg-default);border:1px solid var(--color-border-default);border-radius:var(--radius-md);box-shadow:var(--shadow-xs);padding:12px 14px}
        .saida-insight-title{display:flex;align-items:center;gap:6px;color:var(--color-text-secondary);font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:8px}
        .saida-insight-row{display:flex;justify-content:space-between;gap:12px;padding:7px 0;border-top:1px solid var(--color-border-muted);font-size:12px}
        .saida-insight-row span{color:var(--color-text-secondary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
        .saida-insight-row strong{color:var(--color-text-primary);font-variant-numeric:tabular-nums;white-space:nowrap}
        .saida-insight-empty,.saida-result-count{color:var(--color-text-tertiary);font-size:12px}
        .saida-result-count{margin-left:auto;white-space:nowrap}
        .saida-filter-strip{display:flex;gap:8px;padding:10px 20px;border-bottom:1px solid var(--color-border-default);background:var(--color-bg-elevated);flex-wrap:wrap}
        .saida-filter-chip{display:inline-flex;align-items:center;gap:6px;height:28px;padding:0 10px;border:1px solid var(--color-border-default);border-radius:6px;background:var(--color-bg-default);color:var(--color-text-secondary);font-size:12px;font-weight:700;cursor:pointer;transition:background 100ms,border-color 100ms,color 100ms}
        .saida-filter-chip span{color:var(--color-text-tertiary);font-variant-numeric:tabular-nums}
        .saida-filter-chip:hover,.saida-filter-chip.active{background:var(--color-bg-subtle);border-color:var(--color-border-strong);color:var(--color-text-primary)}
        .saida-table-scroll{overflow:auto;max-height:calc(100vh - 410px)}
        .saida-table thead th{position:sticky;top:0;z-index:2;background:var(--color-bg-elevated)}
        .saida-table tbody tr{transition:background 100ms}
        .saida-table tbody tr:hover{background:var(--color-bg-subtle)}
        .saida-row-high{box-shadow:inset 3px 0 0 var(--color-danger-600);background:var(--color-danger-50)}
        .sort-th{display:inline-flex;align-items:center;gap:4px;color:inherit;font:inherit;font-weight:700;cursor:pointer}
        .sort-th-right{justify-content:flex-end;width:100%}
        .saida-id-button{color:var(--color-brand-700);font:inherit;font-weight:800;cursor:pointer}
        .saida-id-button:hover{text-decoration:underline}
        .saida-qty{display:inline-flex;align-items:center;height:24px;padding:0 8px;border-radius:var(--radius-full);background:var(--color-danger-50);border:1px solid var(--color-danger-200);color:var(--color-danger-700);font-weight:800;font-variant-numeric:tabular-nums}
        .saida-impact{display:inline-flex;align-items:center;height:22px;padding:0 8px;border-radius:var(--radius-full);border:1px solid var(--color-border-default);font-size:11px;font-weight:800}
        .saida-impact-high{background:var(--color-danger-50);border-color:var(--color-danger-200);color:var(--color-danger-700)}
        .saida-impact-normal{background:var(--color-bg-subtle);border-color:var(--color-border-muted);color:var(--color-text-secondary)}
        .saida-impact-neutral{background:var(--color-bg-muted);border-color:var(--color-border-muted);color:var(--color-text-tertiary)}
        .saida-rfid{display:inline-flex;align-items:center;height:22px;padding:0 8px;border:1px solid var(--color-info-100);border-radius:var(--radius-full);background:var(--color-info-50);color:var(--color-info-700);font-size:10px;font-weight:800;letter-spacing:0.08em}
        .saida-destination{display:flex;flex-direction:column;gap:2px;min-width:140px}
        .saida-destination strong{color:var(--color-text-primary);font-size:12px;font-weight:700}
        .saida-destination span{color:var(--color-text-tertiary);font-size:11px}
        .saida-actions{position:relative;display:inline-flex;justify-content:flex-end}
        .saida-actions-menu{position:absolute;right:0;top:34px;z-index:4;min-width:178px;padding:6px;background:var(--color-bg-default);border:1px solid var(--color-border-default);border-radius:var(--radius-md);box-shadow:var(--shadow-md)}
        .saida-actions-menu a,.saida-actions-menu button{width:100%;display:flex;align-items:center;gap:8px;min-height:30px;padding:0 8px;border-radius:5px;color:var(--color-text-secondary);font-size:12px;font-weight:600;text-align:left;text-decoration:none}
        .saida-actions-menu a:hover,.saida-actions-menu button:hover{background:var(--color-bg-subtle);color:var(--color-text-primary)}
        .saida-drawer-layer{position:fixed;inset:0;z-index:30;display:flex;justify-content:flex-end;background:transparent}
        .saida-drawer{width:min(480px,100%);height:100%;background:var(--color-bg-default);border-left:1px solid var(--color-border-default);box-shadow:var(--shadow-lg);animation:drawerIn 160ms ease-out;display:flex;flex-direction:column}
        .saida-drawer-header{display:flex;justify-content:space-between;gap:16px;padding:20px;border-bottom:1px solid var(--color-border-default);background:var(--color-bg-elevated)}
        .saida-drawer-eyebrow{color:var(--color-text-tertiary);font-size:10px;font-weight:800;letter-spacing:0.08em;text-transform:uppercase}
        .saida-drawer h2{margin:4px 0 0;color:var(--color-text-primary);font-family:"IBM Plex Mono",monospace;font-size:20px}
        .saida-drawer-subtitle{margin-top:4px;color:var(--color-text-secondary);font-size:13px;font-weight:600}
        .saida-drawer-body{flex:1;overflow:auto;padding:16px 20px}
        .saida-drawer-row{display:flex;justify-content:space-between;gap:16px;padding:10px 0;border-bottom:1px solid var(--color-border-muted);font-size:13px}
        .saida-drawer-row span{color:var(--color-text-tertiary)}
        .saida-drawer-row strong{color:var(--color-text-primary);text-align:right;font-weight:700}
        .saida-timeline{margin-top:18px;padding-top:14px;border-top:1px solid var(--color-border-default)}
        .saida-timeline-title{margin-bottom:10px;color:var(--color-text-secondary);font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:0.06em}
        .saida-timeline-item{display:grid;grid-template-columns:120px 1fr;gap:4px 10px;padding:9px 0;border-bottom:1px solid var(--color-border-muted);font-size:12px}
        .saida-timeline-item span{color:var(--color-text-tertiary);font-family:"IBM Plex Mono",monospace}
        .saida-timeline-item strong{color:var(--color-text-primary);text-transform:capitalize}
        .saida-timeline-item small{grid-column:2;color:var(--color-text-tertiary)}
        .saida-timeline-empty{color:var(--color-text-tertiary);font-size:13px;padding:16px 0}
        .saida-drawer-actions{display:flex;gap:8px;padding:14px 20px;border-top:1px solid var(--color-border-default);flex-wrap:wrap}
        .saida-form-error{display:flex;align-items:center;gap:8px;padding:10px 14px;background:var(--color-danger-50);border:1px solid var(--color-danger-200);border-radius:var(--radius-md);margin-bottom:16px;font-size:13px;color:var(--color-danger-700)}
        @media (max-width:1180px){.saida-kpi-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.saida-insights-grid{grid-template-columns:1fr}}
        @media (max-width:700px){.saida-kpi-grid{grid-template-columns:1fr}.saida-table-scroll{max-height:none}.saida-drawer-actions .btn{width:100%;justify-content:center}}
      `}</style>
    </Layout>
  )
}

