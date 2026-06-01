import { useMemo, useState, useEffect } from 'react'
import Layout from '../components/Layout.jsx'
import { useToast } from '../context/ToastContext.jsx'
import api from '../api/axios.js'
import {
  Plus, Download, Search, Shuffle, CheckCircle, X, ArrowRight,
  AlertTriangle, MoreVertical, Activity, ShieldCheck, Clock,
  ArrowUp, ArrowDown, Boxes, Users, MapPin, Layers,
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
    brand:   'var(--color-brand-600)',
    danger:  'var(--color-danger-600)',
    success: 'var(--color-success-600)',
    info:    'var(--color-info-600)',
    warning: 'var(--color-warning-600)',
  }[tone] || 'var(--color-text-secondary)'
  return (
    <div className="tf-kpi-card">
      <div className="tf-kpi-icon" style={{ color }}><Icon size={16} /></div>
      <div>
        <div className="tf-kpi-label">{label}</div>
        <div className="tf-kpi-value">{value}</div>
      </div>
    </div>
  )
}

function extractCorredor(name) {
  if (!name) return null
  const m = String(name).match(/^([A-Za-z]+)/)
  return m ? m[1].toUpperCase() : null
}

function getDistance(m) {
  const oriCor = m.origem_corredor || extractCorredor(m.localizacao_origem_nome || m.localizacao_origem)
  const dstCor = m.destino_corredor || extractCorredor(m.localizacao_destino_nome || m.localizacao_destino)
  if (!oriCor || !dstCor) return null
  if (oriCor === dstCor) return 'curta'
  const diff = Math.abs(oriCor.charCodeAt(0) - dstCor.charCodeAt(0))
  return diff <= 2 ? 'curta' : 'longa'
}

function isPending(m) {
  const s = (m.status || '').toLowerCase().replace(/[^a-z]/g, '')
  return s === 'pendente' || s === 'emandamento'
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

function formatDateTime(value) {
  return value ? new Date(value).toLocaleString('pt-BR') : '—'
}

function formatQty(value) {
  return Number(value || 0).toLocaleString('pt-BR')
}

function fmtLoc(m) {
  const ori = m.localizacao_origem_nome
    || (m.origem_corredor ? `${m.origem_corredor}-N${m.origem_nivel}-P${m.origem_posicao}` : (m.localizacao_origem || '—'))
  const dst = m.localizacao_destino_nome
    || (m.destino_corredor ? `${m.destino_corredor}-N${m.destino_nivel}-P${m.destino_posicao}` : (m.localizacao_destino || '—'))
  return { ori, dst }
}

function HeatmapSVG({ data }) {
  if (!data.length) {
    return <div style={{ color: 'var(--color-text-tertiary)', fontSize: 12, padding: '8px 0' }}>Sem dados de corredor.</div>
  }
  const max = Math.max(...data.map(d => d.count), 1)
  const cols = Math.min(data.length, 5)
  const rows = Math.ceil(data.length / cols)
  const cw = 54, ch = 38, p = 5
  const w = cols * (cw + p) + p
  const h = rows * (ch + p) + p
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ display: 'block', maxWidth: '100%' }} aria-label="Heatmap de atividade por corredor" role="img">
      {data.map((d, i) => {
        const col = i % cols
        const row = Math.floor(i / cols)
        const x = p + col * (cw + p)
        const y = p + row * (ch + p)
        const alpha = (0.18 + (d.count / max) * 0.72).toFixed(2)
        return (
          <g key={d.label}>
            <rect x={x} y={y} width={cw} height={ch} rx={5} fill={`rgba(46,117,182,${alpha})`} />
            <text x={x + cw / 2} y={y + 15} textAnchor="middle" fontSize={12} style={{ fill: 'var(--color-text-inverse)' }} fontWeight={700} fontFamily="IBM Plex Mono, monospace">{d.label}</text>
            <text x={x + cw / 2} y={y + 29} textAnchor="middle" fontSize={10} style={{ fill: 'var(--color-text-inverse)', opacity: 0.85 }} fontFamily="IBM Plex Mono, monospace">{d.count}</text>
          </g>
        )
      })}
    </svg>
  )
}

export default function Transferencia() {
  const toast = useToast()
  const [movs, setMovs] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [quickFilter, setQuickFilter] = useState('todas')
  const [sort, setSort] = useState({ key: 'data', dir: 'desc' })
  const [showForm, setShowForm] = useState(false)
  const [lotes, setLotes] = useState([])
  const [locs, setLocs] = useState([])
  const [form, setForm] = useState({ id_lote: '', id_localizacao_destino: '', quantidade: '', motivo_movimentacao: '' })
  const [submitting, setSubmitting] = useState(false)
  const [formErr, setFormErr] = useState('')
  const [selectedTf, setSelectedTf] = useState(null)
  const [openMenuId, setOpenMenuId] = useState(null)
  const [timeline, setTimeline] = useState([])
  const [timelineLoading, setTimelineLoading] = useState(false)

  useEffect(() => { load() }, [])

  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') { setSelectedTf(null); setOpenMenuId(null) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  async function load() {
    setLoading(true)
    try {
      const { data } = await api.get('/movimentacoes', { params: { tipo: 'transferencia', limit: 500 } })
      const items = (data.data || data || []).filter(m => !m.tipo || m.tipo === 'transferencia')
      setMovs(items)
      setTotal(items.length)
    } catch {
      toast.error('Erro ao carregar transferências.')
    } finally {
      setLoading(false)
    }
  }

  async function openForm() {
    setShowForm(true)
    setForm({ id_lote: '', id_localizacao_destino: '', quantidade: '', motivo_movimentacao: '' })
    setFormErr('')
    try {
      const [lotesRes, locsRes] = await Promise.all([
        api.get('/lotes', { params: { limit: 100 } }),
        api.get('/localizacoes'),
      ])
      setLotes(lotesRes.data.data || [])
      setLocs(locsRes.data.data || locsRes.data || [])
    } catch {}
  }

  const motivoValido = form.motivo_movimentacao.trim().length >= 10

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.id_lote || !form.id_localizacao_destino || !form.quantidade || !motivoValido) return
    setSubmitting(true)
    setFormErr('')
    try {
      await api.post('/movimentacoes/transferencia', {
        id_lote: Number(form.id_lote),
        id_localizacao_destino: Number(form.id_localizacao_destino),
        quantidade: Number(form.quantidade),
        motivo_movimentacao: form.motivo_movimentacao,
      })
      toast.success('Transferência registrada com sucesso!')
      setShowForm(false)
      load()
    } catch (err) {
      setFormErr(err.response?.data?.error || 'Erro ao registrar transferência.')
    } finally {
      setSubmitting(false)
    }
  }

  async function openDrawer(m) {
    setSelectedTf(m)
    setOpenMenuId(null)
    setTimeline([])
    setTimelineLoading(true)
    try {
      const { data } = await api.get(`/lotes/${m.id_lote}/timeline`)
      setTimeline(Array.isArray(data) ? data.slice(0, 6) : [])
    } catch {
      setTimeline([])
    } finally {
      setTimelineLoading(false)
    }
  }

  const enrichedMovs = useMemo(() => movs.map(m => {
    const { ori, dst } = fmtLoc(m)
    const distance = getDistance(m)
    const pending = isPending(m)
    return {
      ...m,
      tfDate: m.data_movimentacao || m.criado_em,
      loteCode: m.numero_lote || m.codigo_lote || m.id_lote,
      oriLabel: ori,
      dstLabel: dst,
      distance,
      pending,
      motivo: m.motivo_movimentacao || m.motivo || '—',
      statusLabel: pending ? 'Pendente' : 'Concluída',
    }
  }), [movs])

  const kpis = useMemo(() => {
    const todayRows = enrichedMovs.filter(m => isToday(m.tfDate))
    const posicoes = new Set()
    todayRows.forEach(m => {
      if (m.oriLabel && m.oriLabel !== '—') posicoes.add(m.oriLabel)
      if (m.dstLabel && m.dstLabel !== '—') posicoes.add(m.dstLabel)
    })
    return {
      hoje: todayRows.length,
      volume: todayRows.reduce((s, m) => s + Number(m.quantidade || 0), 0),
      posicoes: posicoes.size,
      operadores: new Set(todayRows.map(m => m.usuario_nome).filter(Boolean)).size,
    }
  }, [enrichedMovs])

  const filterCounts = useMemo(() => ({
    todas: enrichedMovs.length,
    hoje: enrichedMovs.filter(m => isToday(m.tfDate)).length,
    semana: enrichedMovs.filter(m => isThisWeek(m.tfDate)).length,
    curta: enrichedMovs.filter(m => m.distance === 'curta').length,
    longa: enrichedMovs.filter(m => m.distance === 'longa').length,
    pendentes: enrichedMovs.filter(m => m.pending).length,
  }), [enrichedMovs])

  const filteredMovs = useMemo(() => {
    const q = search.trim().toLowerCase()
    const byFilter = enrichedMovs.filter(m => {
      if (quickFilter === 'hoje') return isToday(m.tfDate)
      if (quickFilter === 'semana') return isThisWeek(m.tfDate)
      if (quickFilter === 'curta') return m.distance === 'curta'
      if (quickFilter === 'longa') return m.distance === 'longa'
      if (quickFilter === 'pendentes') return m.pending
      return true
    })
    const bySearch = byFilter.filter(m => {
      if (!q) return true
      return [m.id, m.loteCode, m.produto_nome, m.oriLabel, m.dstLabel, m.usuario_nome, m.motivo]
        .some(v => String(v || '').toLowerCase().includes(q))
    })
    const dir = sort.dir === 'asc' ? 1 : -1
    return [...bySearch].sort((a, b) => {
      const vals = {
        data:       [new Date(a.tfDate || 0).getTime(), new Date(b.tfDate || 0).getTime()],
        lote:       [a.loteCode || '', b.loteCode || ''],
        produto:    [a.produto_nome || '', b.produto_nome || ''],
        quantidade: [Number(a.quantidade || 0), Number(b.quantidade || 0)],
        origem:     [a.oriLabel || '', b.oriLabel || ''],
        destino:    [a.dstLabel || '', b.dstLabel || ''],
      }[sort.key] || ['', '']
      const [av, bv] = vals
      if (typeof av === 'number') return (av - bv) * dir
      return String(av).localeCompare(String(bv), 'pt-BR') * dir
    })
  }, [enrichedMovs, quickFilter, search, sort])

  const topFlows = useMemo(() => {
    const map = new Map()
    enrichedMovs.forEach(m => {
      if (m.oriLabel === '—' || m.dstLabel === '—') return
      const key = `${m.oriLabel} → ${m.dstLabel}`
      map.set(key, (map.get(key) || 0) + 1)
    })
    return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5)
  }, [enrichedMovs])

  const topAreas = useMemo(() => {
    const map = new Map()
    enrichedMovs.forEach(m => {
      const oriCor = m.origem_corredor || extractCorredor(m.oriLabel)
      const dstCor = m.destino_corredor || extractCorredor(m.dstLabel)
      if (oriCor) map.set(oriCor, (map.get(oriCor) || 0) + 1)
      if (dstCor) map.set(dstCor, (map.get(dstCor) || 0) + 1)
    })
    return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6)
  }, [enrichedMovs])

  const heatmapData = useMemo(() => topAreas.map(([label, count]) => ({ label, count })), [topAreas])

  function changeSort(key) {
    setSort(cur => cur.key === key ? { key, dir: cur.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' })
  }

  function sortIcon(key) {
    if (sort.key !== key) return null
    return sort.dir === 'asc' ? <ArrowUp size={11} /> : <ArrowDown size={11} />
  }

  return (
    <Layout breadcrumb={['Movimentações', 'Transferência']}>
      <div className="page-header">
        <div className="page-header-left">
          <h1>Central de Movimentação Interna</h1>
          <div className="subtitle">
            <span>Rastreamento e controle de transferências entre posições do armazém</span>
          </div>
        </div>
        <div className="page-header-actions">
          <button className="btn btn-outline btn-sm"><Download size={14} /> Exportar</button>
          <button className="btn btn-primary" onClick={openForm}><Plus size={14} /> Nova transferência</button>
        </div>
      </div>

      <div className="tf-kpi-grid">
        <KpiCard icon={Shuffle}  label="Transferências Hoje" value={kpis.hoje}              tone="brand"   />
        <KpiCard icon={Boxes}    label="Volume Movimentado"  value={formatQty(kpis.volume)} tone="info"    />
        <KpiCard icon={MapPin}   label="Posições Afetadas"   value={kpis.posicoes}          tone="success" />
        <KpiCard icon={Users}    label="Operadores Ativos"   value={kpis.operadores}        tone="warning" />
      </div>

      <div className="tf-insights-grid">
        <div className="tf-insight-card">
          <div className="tf-insight-title"><Shuffle size={14} /> Fluxo do Armazém</div>
          {topFlows.length === 0
            ? <div className="tf-insight-empty">Sem fluxos registrados.</div>
            : topFlows.map(([route, count]) => (
              <div key={route} className="tf-insight-row">
                <span className="tf-insight-route">{route}</span>
                <strong>{count}</strong>
              </div>
            ))}
        </div>

        <div className="tf-insight-card">
          <div className="tf-insight-title"><Layers size={14} /> Áreas Mais Movimentadas</div>
          {topAreas.length === 0
            ? <div className="tf-insight-empty">Sem áreas identificadas.</div>
            : topAreas.slice(0, 5).map(([area, count]) => (
              <div key={area} className="tf-insight-row">
                <span>Corredor {area}</span>
                <strong>{count} mov.</strong>
              </div>
            ))}
        </div>

        <div className="tf-insight-card">
          <div className="tf-insight-title"><Activity size={14} /> Heatmap de Corredores</div>
          <HeatmapSVG data={heatmapData} />
        </div>
      </div>

      <div className="table-wrap">
        <div className="table-toolbar">
          <div className="table-search">
            <Search size={14} />
            <input
              type="text"
              placeholder="Buscar por lote, produto, origem, destino ou operador…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <div className="tf-result-count">{filteredMovs.length} resultados</div>
        </div>

        <div className="tf-filter-strip">
          {[
            ['todas',     'Todas'],
            ['hoje',      'Hoje'],
            ['semana',    'Semana'],
            ['curta',     'Curta Distância'],
            ['longa',     'Longa Distância'],
            ['pendentes', 'Pendentes'],
          ].map(([id, label]) => (
            <button
              key={id}
              type="button"
              className={`tf-filter-chip${quickFilter === id ? ' active' : ''}`}
              onClick={() => setQuickFilter(id)}
            >
              {label} <span>{filterCounts[id]}</span>
            </button>
          ))}
        </div>

        <div className="tf-table-scroll">
          <table className="tf-table">
            <thead>
              <tr>
                <th>ID</th>
                <th><button className="sort-th" onClick={() => changeSort('data')}>Data / Hora {sortIcon('data')}</button></th>
                <th><button className="sort-th" onClick={() => changeSort('lote')}>Lote {sortIcon('lote')}</button></th>
                <th><button className="sort-th" onClick={() => changeSort('produto')}>Produto {sortIcon('produto')}</button></th>
                <th style={{ textAlign: 'right' }}><button className="sort-th sort-th-right" onClick={() => changeSort('quantidade')}>Qtd {sortIcon('quantidade')}</button></th>
                <th><button className="sort-th" onClick={() => changeSort('origem')}>Origem → Destino {sortIcon('origem')}</button></th>
                <th>Distância</th>
                <th>Motivo</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {loading
                ? Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)
                : filteredMovs.length === 0
                  ? (
                    <tr><td colSpan={10}>
                      <div className="empty-state">
                        <div className="empty-icon empty-icon-animated"><Shuffle size={24} /></div>
                        <div className="empty-title">Nenhuma transferência encontrada</div>
                        <div className="empty-sub">{search ? 'Tente outro termo de busca.' : 'Registre a primeira transferência de lote.'}</div>
                      </div>
                    </td></tr>
                  )
                  : filteredMovs.map((m, i) => (
                    <tr key={m.id || i} className={m.pending ? 'tf-row-pending' : ''}>
                      <td style={{ fontFamily: '"IBM Plex Mono",monospace', fontSize: 11, color: 'var(--color-brand-700)', fontWeight: 600 }}>
                        <button type="button" className="tf-id-btn" onClick={() => openDrawer(m)}>{m.id}</button>
                      </td>
                      <td style={{ fontFamily: '"IBM Plex Mono",monospace', fontSize: 11 }}>{formatDateTime(m.tfDate)}</td>
                      <td style={{ fontFamily: '"IBM Plex Mono",monospace', fontSize: 11 }}>{m.loteCode}</td>
                      <td style={{ fontWeight: 600 }}>{m.produto_nome || '—'}</td>
                      <td style={{ textAlign: 'right' }}>
                        <span className="tf-qty">{formatQty(m.quantidade)}</span>
                      </td>
                      <td>
                        <div className="tf-route-cell">
                          <span className="tf-loc tf-loc-ori">{m.oriLabel}</span>
                          <ArrowRight size={11} style={{ color: 'var(--color-text-tertiary)', flexShrink: 0 }} />
                          <span className="tf-loc tf-loc-dst">{m.dstLabel}</span>
                        </div>
                      </td>
                      <td>
                        {m.distance
                          ? <span className={`tf-dist tf-dist-${m.distance}`}>{m.distance === 'curta' ? 'Curta' : 'Longa'}</span>
                          : <span style={{ color: 'var(--color-text-tertiary)', fontSize: 12 }}>—</span>}
                      </td>
                      <td>
                        <span className="tf-motivo" title={m.motivo}>{m.motivo}</span>
                      </td>
                      <td>
                        <span className={`tf-status ${m.pending ? 'tf-status-pending' : 'tf-status-done'}`}>
                          {m.statusLabel}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div className="tf-actions">
                          <button
                            className="icon-btn"
                            aria-label="Ações"
                            onClick={() => setOpenMenuId(openMenuId === m.id ? null : m.id)}
                          >
                            <MoreVertical size={14} />
                          </button>
                          {openMenuId === m.id && (
                            <div className="tf-menu">
                              <button type="button" onClick={() => openDrawer(m)}><Activity size={13} /> Visualizar</button>
                              <a href={`/rastreabilidade?lote=${m.id_lote}`}><ShieldCheck size={13} /> Rastreabilidade</a>
                              <a href={`/movimentacoes?lote=${m.id_lote}`}><Clock size={13} /> Movimentações</a>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
              }
            </tbody>
          </table>
        </div>

        <div className="pagination">
          <span className="pagination-info">Exibindo {filteredMovs.length} de {total} transferências</span>
        </div>
      </div>

      {selectedTf && (
        <div className="tf-drawer-layer" onMouseDown={e => { if (e.target === e.currentTarget) setSelectedTf(null) }}>
          <aside className="tf-drawer" role="dialog" aria-label="Detalhes da transferência">
            <div className="tf-drawer-header">
              <div>
                <div className="tf-drawer-eyebrow">Transferência</div>
                <h2>#{selectedTf.id}</h2>
                <div className="tf-drawer-subtitle">{selectedTf.produto_nome || '—'}</div>
              </div>
              <button className="icon-btn" onClick={() => setSelectedTf(null)} aria-label="Fechar"><X size={15} /></button>
            </div>

            <div className="tf-drawer-body">
              <div className="tf-drawer-route">
                <div className="tf-drawer-route-loc">
                  <div className="tf-drawer-route-label">Origem</div>
                  <div className="tf-drawer-route-value">{selectedTf.oriLabel || '—'}</div>
                </div>
                <ArrowRight size={18} style={{ color: 'var(--color-text-tertiary)', flexShrink: 0 }} />
                <div className="tf-drawer-route-loc">
                  <div className="tf-drawer-route-label">Destino</div>
                  <div className="tf-drawer-route-value">{selectedTf.dstLabel || '—'}</div>
                </div>
              </div>

              {[
                ['Data / Hora', formatDateTime(selectedTf.tfDate)],
                ['Lote',        selectedTf.loteCode || '—'],
                ['Produto',     selectedTf.produto_nome || '—'],
                ['Quantidade',  `${formatQty(selectedTf.quantidade)} un`],
                ['Distância',   selectedTf.distance === 'curta' ? 'Curta' : selectedTf.distance === 'longa' ? 'Longa' : '—'],
                ['Motivo',      selectedTf.motivo],
                ['Operador',    selectedTf.usuario_nome || '—'],
                ['Status',      selectedTf.statusLabel],
              ].map(([label, value]) => (
                <div key={label} className="tf-drawer-row">
                  <span>{label}</span>
                  <strong>{value}</strong>
                </div>
              ))}

              <div className="tf-timeline">
                <div className="tf-timeline-title">Timeline Operacional</div>
                {timelineLoading
                  ? <div className="tf-timeline-empty">Carregando timeline...</div>
                  : timeline.length === 0
                    ? <div className="tf-timeline-empty">Sem eventos registrados.</div>
                    : timeline.map(item => (
                      <div key={item.id} className="tf-timeline-item">
                        <span>{formatDateTime(item.data_movimentacao)}</span>
                        <strong>{item.tipo || 'Movimentação'}</strong>
                        <small>{item.usuario_nome || '—'}</small>
                      </div>
                    ))
                }
              </div>
            </div>

            <div className="tf-drawer-actions">
              <a className="btn btn-primary" href={`/rastreabilidade?lote=${selectedTf.id_lote}`}>Rastreabilidade</a>
              <a className="btn btn-outline" href={`/movimentacoes?lote=${selectedTf.id_lote}`}>Movimentações</a>
            </div>
          </aside>
        </div>
      )}

      {showForm && (
        <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && setShowForm(false)}>
          <div className="modal">
            <div className="modal-header">
              <h3 className="modal-title">Nova Transferência</h3>
              <button className="icon-btn" onClick={() => setShowForm(false)}><X size={16} /></button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                {formErr && (
                  <div className="tf-form-error">
                    <AlertTriangle size={14} style={{ flexShrink: 0 }} /> {formErr}
                  </div>
                )}
                <div className="form-group">
                  <label className="form-label">Lote *</label>
                  <select className="select" value={form.id_lote} onChange={e => setForm(f => ({ ...f, id_lote: e.target.value }))} required>
                    <option value="">Selecionar lote…</option>
                    {lotes.map(l => <option key={l.id} value={l.id}>{l.codigo || l.id} — {l.produto_nome || '—'}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Localização destino *</label>
                  <select className="select" value={form.id_localizacao_destino} onChange={e => setForm(f => ({ ...f, id_localizacao_destino: e.target.value }))} required>
                    <option value="">Selecionar localização…</option>
                    {locs.map(l => <option key={l.id} value={l.id}>{l.codigo || `${l.corredor}-N${l.nivel}-P${l.posicao}`}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Quantidade *</label>
                  <input className="input" type="number" min="1" placeholder="0"
                    value={form.quantidade} onChange={e => setForm(f => ({ ...f, quantidade: e.target.value }))} required />
                </div>
                <div className="form-group">
                  <label className="form-label">
                    Motivo *
                    <span style={{ fontSize: 11, marginLeft: 8, color: motivoValido ? 'var(--color-success-600)' : 'var(--color-danger-600)' }}>
                      ({form.motivo_movimentacao.trim().length}/10 mín.)
                    </span>
                  </label>
                  <textarea
                    className="textarea"
                    placeholder="Descreva o motivo da transferência…"
                    style={{ minHeight: 70 }}
                    value={form.motivo_movimentacao}
                    onChange={e => setForm(f => ({ ...f, motivo_movimentacao: e.target.value }))}
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={() => setShowForm(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary" disabled={submitting || !motivoValido}>
                  {submitting
                    ? <><span style={{ width: 13, height: 13, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'var(--color-text-inverse)', borderRadius: '50%', animation: 'spin 0.65s linear infinite', display: 'inline-block' }} /> Registrando…</>
                    : <><CheckCircle size={14} /> Confirmar transferência</>
                  }
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes drawerIn{from{opacity:0;transform:translateX(16px)}to{opacity:1;transform:translateX(0)}}

        .tf-kpi-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin-bottom:16px}
        .tf-kpi-card{display:flex;align-items:center;gap:12px;min-height:74px;padding:12px 14px;background:var(--color-bg-default);border:1px solid var(--color-border-default);border-radius:var(--radius-md);box-shadow:var(--shadow-xs)}
        .tf-kpi-icon{width:30px;height:30px;display:grid;place-items:center;background:var(--color-bg-subtle);border:1px solid var(--color-border-muted);border-radius:var(--radius-sm);flex-shrink:0}
        .tf-kpi-label{font-size:10px;font-weight:700;color:var(--color-text-tertiary);text-transform:uppercase;letter-spacing:0.08em}
        .tf-kpi-value{margin-top:2px;font-size:26px;line-height:1;font-weight:800;color:var(--color-text-primary);font-variant-numeric:tabular-nums}

        .tf-insights-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;margin-bottom:16px}
        .tf-insight-card{background:var(--color-bg-default);border:1px solid var(--color-border-default);border-radius:var(--radius-md);box-shadow:var(--shadow-xs);padding:12px 14px}
        .tf-insight-title{display:flex;align-items:center;gap:6px;color:var(--color-text-secondary);font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:8px}
        .tf-insight-row{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:7px 0;border-top:1px solid var(--color-border-muted);font-size:12px}
        .tf-insight-route{color:var(--color-text-secondary);font-family:"IBM Plex Mono",monospace;font-size:11px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:200px}
        .tf-insight-row span{color:var(--color-text-secondary)}
        .tf-insight-row strong{color:var(--color-text-primary);font-variant-numeric:tabular-nums;white-space:nowrap}
        .tf-insight-empty{color:var(--color-text-tertiary);font-size:12px;padding:8px 0}
        .tf-result-count{margin-left:auto;white-space:nowrap;color:var(--color-text-tertiary);font-size:12px}

        .tf-filter-strip{display:flex;gap:8px;padding:10px 20px;border-bottom:1px solid var(--color-border-default);background:var(--color-bg-elevated);flex-wrap:wrap}
        .tf-filter-chip{display:inline-flex;align-items:center;gap:6px;height:28px;padding:0 10px;border:1px solid var(--color-border-default);border-radius:6px;background:var(--color-bg-default);color:var(--color-text-secondary);font-size:12px;font-weight:700;cursor:pointer;transition:background 100ms,border-color 100ms,color 100ms}
        .tf-filter-chip span{color:var(--color-text-tertiary);font-variant-numeric:tabular-nums}
        .tf-filter-chip:hover,.tf-filter-chip.active{background:var(--color-bg-subtle);border-color:var(--color-border-strong);color:var(--color-text-primary)}

        .tf-table-scroll{overflow:auto;max-height:calc(100vh - 460px)}
        .tf-table thead th{position:sticky;top:0;z-index:2;background:var(--color-bg-elevated)}
        .tf-table tbody tr{transition:background 100ms}
        .tf-table tbody tr:hover{background:var(--color-bg-subtle)}
        .tf-row-pending{box-shadow:inset 3px 0 0 var(--color-warning-500);background:var(--color-warning-50)}

        .sort-th{display:inline-flex;align-items:center;gap:4px;color:inherit;font:inherit;font-weight:700;cursor:pointer}
        .sort-th-right{justify-content:flex-end;width:100%}

        .tf-id-btn{color:var(--color-brand-700);font:inherit;font-weight:800;cursor:pointer}
        .tf-id-btn:hover{text-decoration:underline}

        .tf-qty{display:inline-flex;align-items:center;height:24px;padding:0 8px;border-radius:var(--radius-full);background:var(--color-brand-50);border:1px solid var(--color-brand-200);color:var(--color-brand-700);font-weight:800;font-variant-numeric:tabular-nums;font-size:12px}

        .tf-route-cell{display:flex;align-items:center;gap:5px;min-width:180px}
        .tf-loc{font-family:"IBM Plex Mono",monospace;font-size:11px;padding:2px 6px;border-radius:4px;font-weight:600;white-space:nowrap}
        .tf-loc-ori{background:var(--color-bg-subtle);border:1px solid var(--color-border-muted);color:var(--color-text-secondary)}
        .tf-loc-dst{background:var(--color-brand-50);border:1px solid var(--color-brand-200);color:var(--color-brand-700)}

        .tf-dist{display:inline-flex;align-items:center;height:22px;padding:0 8px;border-radius:var(--radius-full);font-size:11px;font-weight:800}
        .tf-dist-curta{background:var(--color-success-50);border:1px solid var(--color-success-200);color:var(--color-success-700)}
        .tf-dist-longa{background:var(--color-warning-50);border:1px solid var(--color-warning-200);color:var(--color-warning-700)}

        .tf-motivo{display:block;max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px;color:var(--color-text-secondary)}

        .tf-status{display:inline-flex;align-items:center;height:22px;padding:0 8px;border-radius:var(--radius-full);font-size:11px;font-weight:800}
        .tf-status-done{background:var(--color-success-50);border:1px solid var(--color-success-200);color:var(--color-success-700)}
        .tf-status-pending{background:var(--color-warning-50);border:1px solid var(--color-warning-200);color:var(--color-warning-700)}

        .tf-actions{position:relative;display:inline-flex;justify-content:flex-end}
        .tf-menu{position:absolute;right:0;top:34px;z-index:4;min-width:178px;padding:6px;background:var(--color-bg-default);border:1px solid var(--color-border-default);border-radius:var(--radius-md);box-shadow:var(--shadow-md)}
        .tf-menu a,.tf-menu button{width:100%;display:flex;align-items:center;gap:8px;min-height:30px;padding:0 8px;border-radius:5px;color:var(--color-text-secondary);font-size:12px;font-weight:600;text-align:left;text-decoration:none}
        .tf-menu a:hover,.tf-menu button:hover{background:var(--color-bg-subtle);color:var(--color-text-primary)}

        .tf-drawer-layer{position:fixed;inset:0;z-index:30;display:flex;justify-content:flex-end;background:transparent}
        .tf-drawer{width:min(500px,100%);height:100%;background:var(--color-bg-default);border-left:1px solid var(--color-border-default);box-shadow:var(--shadow-lg);animation:drawerIn 160ms ease-out;display:flex;flex-direction:column}
        .tf-drawer-header{display:flex;justify-content:space-between;gap:16px;padding:20px;border-bottom:1px solid var(--color-border-default);background:var(--color-bg-elevated)}
        .tf-drawer-eyebrow{color:var(--color-text-tertiary);font-size:10px;font-weight:800;letter-spacing:0.08em;text-transform:uppercase}
        .tf-drawer h2{margin:4px 0 0;color:var(--color-text-primary);font-family:"IBM Plex Mono",monospace;font-size:20px}
        .tf-drawer-subtitle{margin-top:4px;color:var(--color-text-secondary);font-size:13px;font-weight:600}
        .tf-drawer-body{flex:1;overflow:auto;padding:16px 20px}

        .tf-drawer-route{display:flex;align-items:center;gap:12px;padding:14px 16px;background:var(--color-bg-subtle);border:1px solid var(--color-border-muted);border-radius:var(--radius-md);margin-bottom:14px}
        .tf-drawer-route-loc{flex:1;text-align:center}
        .tf-drawer-route-label{font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:0.08em;color:var(--color-text-tertiary);margin-bottom:4px}
        .tf-drawer-route-value{font-family:"IBM Plex Mono",monospace;font-size:14px;font-weight:700;color:var(--color-text-primary)}

        .tf-drawer-row{display:flex;justify-content:space-between;gap:16px;padding:10px 0;border-bottom:1px solid var(--color-border-muted);font-size:13px}
        .tf-drawer-row span{color:var(--color-text-tertiary)}
        .tf-drawer-row strong{color:var(--color-text-primary);text-align:right;font-weight:700}

        .tf-timeline{margin-top:18px;padding-top:14px;border-top:1px solid var(--color-border-default)}
        .tf-timeline-title{margin-bottom:10px;color:var(--color-text-secondary);font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:0.06em}
        .tf-timeline-item{display:grid;grid-template-columns:120px 1fr;gap:4px 10px;padding:9px 0;border-bottom:1px solid var(--color-border-muted);font-size:12px}
        .tf-timeline-item span{color:var(--color-text-tertiary);font-family:"IBM Plex Mono",monospace}
        .tf-timeline-item strong{color:var(--color-text-primary);text-transform:capitalize}
        .tf-timeline-item small{grid-column:2;color:var(--color-text-tertiary)}
        .tf-timeline-empty{color:var(--color-text-tertiary);font-size:13px;padding:16px 0}

        .tf-drawer-actions{display:flex;gap:8px;padding:14px 20px;border-top:1px solid var(--color-border-default);flex-wrap:wrap}

        .tf-form-error{display:flex;align-items:center;gap:8px;padding:10px 14px;background:var(--color-danger-50);border:1px solid var(--color-danger-200);border-radius:var(--radius-md);margin-bottom:16px;font-size:13px;color:var(--color-danger-700)}

        @media(max-width:1180px){.tf-kpi-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.tf-insights-grid{grid-template-columns:1fr}}
        @media(max-width:700px){.tf-kpi-grid{grid-template-columns:1fr}.tf-table-scroll{max-height:none}.tf-drawer-actions .btn{width:100%;justify-content:center}}
      `}</style>
    </Layout>
  )
}

