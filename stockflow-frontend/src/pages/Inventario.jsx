import { useEffect, useMemo, useState } from 'react'
import Layout from '../components/Layout.jsx'
import { useToast } from '../context/ToastContext.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import api from '../api/axios.js'
import {
  Plus, ClipboardList, CheckCircle, AlertTriangle, FileText,
  ArrowLeft, X, Download, MoreVertical, ShieldCheck, Layers,
} from 'lucide-react'

/* ─── Status map ──────────────────────────────────────────── */
const ETAPA = {
  iniciado:   { label: 'Iniciado',    cls: 'badge-info'    },
  contando:   { label: 'Em contagem', cls: 'badge-warning' },
  confirmado: { label: 'Confirmado',  cls: 'badge-admin'   },
  finalizado: { label: 'Finalizado',  cls: 'badge-success' },
}

/* ─── Shared helpers (used in all modes) ──────────────────── */
function parseItems(inv) {
  if (!inv?.itens) return []
  if (Array.isArray(inv.itens)) return inv.itens
  try { return JSON.parse(inv.itens) } catch { return [] }
}

function etapaBadge(etapa) {
  const cfg = ETAPA[etapa] || ETAPA.iniciado
  return (
    <span className={`badge ${cfg.cls}`}>
      {etapa === 'contando' && <span className="live-dot" style={{ marginRight: 4 }} />}
      {cfg.label}
    </span>
  )
}

function diffView(value) {
  if (value === null || value === undefined || value === '') return <span style={{ color: 'var(--color-text-tertiary)' }}>—</span>
  const n = Number(value)
  if (n === 0) return <span style={{ color: 'var(--color-success-700)', fontWeight: 700 }}>✓ 0</span>
  if (n > 0) return <span style={{ color: 'var(--color-warning-700)', fontWeight: 700 }}>+{n}</span>
  return <span style={{ color: 'var(--color-danger-700)', fontWeight: 700 }}>{n}</span>
}

function rowBg(item) {
  if (item.qtd_contada === null || item.qtd_contada === undefined) return undefined
  const diff = Number((Number(item.qtd_contada) - Number(item.qtd_sistema)).toFixed(3))
  if (diff === 0) return 'var(--color-success-50)'
  if (diff > 0) return 'var(--color-warning-50)'
  return 'var(--color-danger-50)'
}

/* ─── Lista-mode helpers ───────────────────────────────────── */
function isToday(value) {
  if (!value) return false
  return new Date(value).toDateString() === new Date().toDateString()
}

function calcDuration(inv) {
  if (!inv.iniciado_em) return null
  if (!inv.concluido_em) return 'em_andamento'
  const diffMin = Math.round((new Date(inv.concluido_em) - new Date(inv.iniciado_em)) / 60000)
  if (diffMin <= 0) return '< 1 min'
  if (diffMin >= 60) {
    const h = Math.floor(diffMin / 60)
    const m = diffMin % 60
    return m > 0 ? `${h}h ${m}min` : `${h}h`
  }
  return `${diffMin} min`
}

function calcEfficiency(inv) {
  const total = Number(inv.total_itens || inv.total_posicoes || 0)
  const done  = Number(inv.total_conferidas || 0)
  if (!total) return null
  return Math.min(100, Math.round((done / total) * 100))
}

function buildTimeline(inv) {
  const events = []
  if (inv.iniciado_em) events.push({ label: 'Inventário iniciado', ts: inv.iniciado_em, op: inv.usuario_nome })
  if (inv.etapa === 'contando') events.push({ label: 'Contagem em andamento', ts: null, op: null })
  if (inv.etapa === 'confirmado' || inv.etapa === 'finalizado') events.push({ label: 'Contagem confirmada', ts: null, op: inv.usuario_nome })
  if (inv.etapa === 'finalizado' && inv.concluido_em) events.push({ label: 'Inventário finalizado', ts: inv.concluido_em, op: inv.usuario_nome })
  return events
}

function fmtDT(value) {
  return value ? new Date(value).toLocaleString('pt-BR') : '—'
}

/* ─── Lista-mode components ────────────────────────────────── */
function InvKpiCard({ icon: Icon, label, value, tone }) {
  const color = {
    brand:   'var(--color-brand-600)',
    success: 'var(--color-success-600)',
    danger:  'var(--color-danger-600)',
    warning: 'var(--color-warning-600)',
    info:    'var(--color-info-600)',
  }[tone] || 'var(--color-text-secondary)'
  return (
    <div className="inv-kpi-card">
      <div className="inv-kpi-icon" style={{ color }}><Icon size={16} /></div>
      <div>
        <div className="inv-kpi-label">{label}</div>
        <div className="inv-kpi-value">{value}</div>
      </div>
    </div>
  )
}

function EfficiencyBar({ pct }) {
  if (pct === null || pct === undefined) return <span style={{ color: 'var(--color-text-tertiary)', fontSize: 12 }}>—</span>
  const barColor = pct >= 90
    ? 'var(--color-success-500)'
    : pct >= 70
      ? 'var(--color-warning-500)'
      : 'var(--color-danger-500)'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 80 }}>
      <div style={{ flex: 1, height: 4, background: 'var(--color-bg-muted)', borderRadius: 2, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: barColor, borderRadius: 2, transition: 'width 200ms ease' }} />
      </div>
      <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-text-secondary)', minWidth: 28, textAlign: 'right' }}>{pct}%</span>
    </div>
  )
}

function InvSkeletonRow() {
  return (
    <tr>
      {Array.from({ length: 13 }).map((_, i) => (
        <td key={i}>
          <div className="skeleton" style={{ height: 13 }} />
        </td>
      ))}
    </tr>
  )
}

/* ─── Main component ───────────────────────────────────────── */
export default function Inventario() {
  const toast  = useToast()
  const { user } = useAuth()

  const [inventarios,  setInventarios]  = useState([])
  const [selected,     setSelected]     = useState(null)
  const [mode,         setMode]         = useState('lista')
  const [loading,      setLoading]      = useState(true)
  const [showCreate,   setShowCreate]   = useState(false)
  const [showConfirm,  setShowConfirm]  = useState(false)
  const [showFinalize, setShowFinalize] = useState(false)
  const [corredores,   setCorredores]   = useState([])
  const [usuarios,     setUsuarios]     = useState([])
  const [lotes,        setLotes]        = useState([])
  const [form,         setForm]         = useState({ corredor: '', id_usuario: '' })
  const [counts,       setCounts]       = useState({})
  // lista-mode state
  const [quickFilter,  setQuickFilter]  = useState('todas')
  const [drawerInv,    setDrawerInv]    = useState(null)
  const [openMenuId,   setOpenMenuId]   = useState(null)
  const [actionLoading, setActionLoading] = useState('')
  const [newItemId,    setNewItemId]    = useState(null)

  useEffect(() => { load() }, [])

  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') { setDrawerInv(null); setOpenMenuId(null) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  /* ── API calls (unchanged) ──────────────────────────────── */
  async function load() {
    setLoading(true)
    try {
      const { data } = await api.get('/inventario')
      setInventarios(data.data || [])
    } catch {
      toast.error('Erro ao carregar inventários.')
    } finally {
      setLoading(false)
    }
  }

  async function loadCreateData() {
    setShowCreate(true)
    try {
      const [locRes, loteRes, userRes] = await Promise.allSettled([
        api.get('/localizacoes'),
        api.get('/lotes', { params: { limit: 500 } }),
        api.get('/usuarios'),
      ])
      const locs  = locRes.status  === 'fulfilled' ? (locRes.value.data.data  || locRes.value.data  || []) : []
      const lots  = loteRes.status === 'fulfilled' ? (loteRes.value.data.data || []) : []
      const users = userRes.status === 'fulfilled' ? (userRes.value.data.data || userRes.value.data || []) : [{ id: user?.id, nome: user?.name }]
      const unique = [...new Set(locs.map(l => l.corredor).filter(Boolean))].sort()
      setCorredores(unique)
      setLotes(lots)
      setUsuarios(users.filter(u => u.ativo !== false))
      setForm(f => ({ ...f, corredor: f.corredor || unique[0] || '', id_usuario: f.id_usuario || users[0]?.id || '' }))
      setCounts(Object.fromEntries(unique.map(c => [c, lots.filter(l => l.corredor === c && (l.status_lote || l.status) === 'ativo').length])))
    } catch {
      toast.error('Erro ao carregar dados para iniciar inventário.')
    }
  }

  async function refreshSelected(id) {
    const { data } = await api.get(`/inventario/${id}`)
    setSelected(data)
    return data
  }

  function triggerConfetti() {
    const colors = ['#2E75B6', '#16a34a', '#f59e0b', '#dc2626', '#7c3aed', '#bfdbfe']
    for (let i = 0; i < 60; i += 1) {
      const piece = document.createElement('div')
      piece.className = 'confetti-piece'
      piece.style.left = `${Math.random() * 100}vw`
      piece.style.top = '-10px'
      piece.style.background = colors[Math.floor(Math.random() * colors.length)]
      piece.style.animationDuration = `${Math.random() * 2 + 1.5}s`
      piece.style.animationDelay = `${Math.random() * 0.5}s`
      piece.style.width = `${Math.random() * 8 + 4}px`
      piece.style.height = `${Math.random() * 8 + 4}px`
      document.body.appendChild(piece)
      setTimeout(() => piece.remove(), 4000)
    }
  }

  async function startInventory(e) {
    e.preventDefault()
    setActionLoading('create')
    try {
      const { data } = await api.post('/inventario', {
        corredor:    form.corredor,
        id_usuario:  form.id_usuario ? Number(form.id_usuario) : undefined,
      })
      toast.success('Inventário iniciado.')
      setNewItemId(data.id)
      setTimeout(() => setNewItemId(null), 2000)
      setShowCreate(false)
      setSelected(data)
      setMode('contagem')
      load()
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erro ao iniciar inventário.')
    } finally {
      setActionLoading('')
    }
  }

  async function openInventory(inv, nextMode) {
    setDrawerInv(null)
    setOpenMenuId(null)
    try {
      const data = await refreshSelected(inv.id)
      setMode(nextMode || (data.etapa === 'finalizado' ? 'relatorio' : 'contagem'))
    } catch {
      toast.error('Erro ao abrir inventário.')
    }
  }

  function updateLocalCount(idLote, value) {
    setSelected(inv => {
      const itens = parseItems(inv).map(item => {
        if (Number(item.id_lote) !== Number(idLote)) return item
        const qtd = value === '' ? null : Number(value)
        return { ...item, qtd_contada: qtd, divergencia: qtd === null ? null : Number((qtd - Number(item.qtd_sistema)).toFixed(3)) }
      })
      return { ...inv, itens }
    })
  }

  async function saveCount(item) {
    if (item.qtd_contada === null || item.qtd_contada === undefined || item.qtd_contada === '') return
    try {
      const { data } = await api.patch(`/inventario/${selected.id}/contar`, { id_lote: item.id_lote, qtd_contada: Number(item.qtd_contada) })
      setSelected(data)
      toast.info('Salvo')
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erro ao salvar contagem.')
    }
  }

  async function confirmInventory() {
    setActionLoading('confirm')
    try {
      const { data } = await api.patch(`/inventario/${selected.id}/confirmar`)
      setSelected(data)
      setShowConfirm(false)
      setMode('confirmado')
      toast.success('Inventário confirmado.')
      load()
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erro ao confirmar inventário.')
    } finally {
      setActionLoading('')
    }
  }

  async function finalizeInventory() {
    setActionLoading('finalize')
    try {
      const { data } = await api.patch(`/inventario/${selected.id}/finalizar`)
      setSelected(data)
      setShowFinalize(false)
      setMode('relatorio')
      toast.success('Inventário finalizado e estoque ajustado.')
      if (Number(data.acuracidade ?? accuracy) >= 100) triggerConfetti()
      load()
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erro ao finalizar inventário.')
    } finally {
      setActionLoading('')
    }
  }

  function exportCSV() {
    const rows = items.map(i => [i.numero_lote, i.produto_nome, i.localizacao, i.qtd_sistema, i.qtd_contada ?? '', i.divergencia ?? ''])
    const csv  = [['Lote', 'Produto', 'Localizacao', 'Qtd Sistema', 'Qtd Contada', 'Divergencia'], ...rows].map(r => r.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = `inventario-${selected?.id || 'relatorio'}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  /* ── Existing computed values (for contagem / confirmado / relatorio modes) */
  const items      = parseItems(selected)
  const counted    = items.filter(i => i.qtd_contada !== null && i.qtd_contada !== undefined).length
  const divergences = items.filter(i => Number(i.divergencia || 0) !== 0)
  const accuracy   = items.length ? (((items.length - divergences.length) / items.length) * 100).toFixed(1) : '100.0'
  const allCounted = items.length > 0 && counted === items.length
  const createCount = form.corredor ? (counts[form.corredor] || 0) : 0

  /* ── Lista-mode computed values ─────────────────────────── */
  const kpis = useMemo(() => {
    const finished       = inventarios.filter(inv => inv.etapa === 'finalizado')
    const inProgress     = inventarios.filter(inv => inv.etapa === 'contando')
    const todayInvs      = inventarios.filter(inv => isToday(inv.iniciado_em))
    const avgAcc         = finished.length
      ? (finished.reduce((s, inv) => s + Number(inv.acuracidade || 0), 0) / finished.length).toFixed(1)
      : null
    const openDiverg     = inProgress.reduce((s, inv) => s + Number(inv.total_divergencias ?? inv.divergencias ?? 0), 0)
    const corridorSet    = new Set(inventarios.map(inv => inv.corredor).filter(Boolean))
    return {
      hoje:        todayInvs.length,
      acuracidade: avgAcc !== null ? `${avgAcc}%` : '—',
      divergencias: openDiverg,
      corredores:  corridorSet.size,
    }
  }, [inventarios])

  const filterCounts = useMemo(() => ({
    todas:       inventarios.length,
    contando:    inventarios.filter(inv => inv.etapa === 'contando').length,
    finalizados: inventarios.filter(inv => inv.etapa === 'finalizado').length,
    divergencia: inventarios.filter(inv => Number(inv.total_divergencias ?? inv.divergencias ?? 0) > 0).length,
    hoje:        inventarios.filter(inv => isToday(inv.iniciado_em)).length,
  }), [inventarios])

  const filteredInventarios = useMemo(() => {
    if (quickFilter === 'contando')    return inventarios.filter(inv => inv.etapa === 'contando')
    if (quickFilter === 'finalizados') return inventarios.filter(inv => inv.etapa === 'finalizado')
    if (quickFilter === 'divergencia') return inventarios.filter(inv => Number(inv.total_divergencias ?? inv.divergencias ?? 0) > 0)
    if (quickFilter === 'hoje')        return inventarios.filter(inv => isToday(inv.iniciado_em))
    return inventarios
  }, [inventarios, quickFilter])

  /* ── Render ──────────────────────────────────────────────── */
  return (
    <Layout breadcrumb={['Movimentações', 'Inventário']}>

      {/* ═══════════════ LISTA ═══════════════ */}
      {mode === 'lista' && (
        <>
          <div className="page-header">
            <div className="page-header-left">
              <h1>Inventário Rotativo</h1>
              <div className="subtitle"><strong>{inventarios.length}</strong> inventários registrados</div>
            </div>
            <div className="page-header-actions">
              <button className="btn btn-primary" onClick={loadCreateData}><Plus size={14} /> Iniciar Inventário</button>
            </div>
          </div>

          {/* KPI Strip */}
          <div className="inv-kpi-grid">
            <InvKpiCard icon={ClipboardList} label="Inventários Hoje"     value={kpis.hoje}          tone="brand"   />
            <InvKpiCard icon={ShieldCheck}   label="Acurácia Média"       value={kpis.acuracidade}   tone="success" />
            <InvKpiCard icon={AlertTriangle} label="Divergências Abertas" value={kpis.divergencias}  tone="danger"  />
            <InvKpiCard icon={Layers}        label="Corredores Cobertos"  value={kpis.corredores}    tone="info"    />
          </div>

          {/* Table */}
          <div className="table-wrap">
            {/* Filter bar — inside table-wrap, padrão Saida/Transferencia */}
            <div className="inv-filter-strip">
              {[
                ['todas',       'Todos'],
                ['contando',    'Em contagem'],
                ['finalizados', 'Finalizados'],
                ['divergencia', 'Com divergência'],
                ['hoje',        'Hoje'],
              ].map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  className={`inv-filter-chip${quickFilter === id ? ' active' : ''}`}
                  onClick={() => setQuickFilter(id)}
                >
                  {label} <span>{filterCounts[id]}</span>
                </button>
              ))}
            </div>

            <div className="inv-table-scroll">
              <table className="inv-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Corredor</th>
                    <th>Início</th>
                    <th>Término</th>
                    <th>Duração</th>
                    <th style={{ textAlign: 'center' }}>Itens</th>
                    <th style={{ textAlign: 'center' }}>Conf.</th>
                    <th style={{ textAlign: 'center' }}>Diverg.</th>
                    <th>Acuracidade</th>
                    <th>Eficiência</th>
                    <th>Status</th>
                    <th>Operador</th>
                    <th style={{ textAlign: 'right', width: 48 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {loading
                    ? Array.from({ length: 4 }).map((_, i) => <InvSkeletonRow key={i} />)
                    : filteredInventarios.length === 0
                      ? (
                        <tr><td colSpan={13}>
                          <div className="empty-state">
                            <div className="empty-icon empty-icon-animated"><ClipboardList size={24} /></div>
                            <div className="empty-title">Nenhum inventário encontrado</div>
                            <div className="empty-sub">{quickFilter !== 'todas' ? 'Tente outro filtro.' : 'Inicie o primeiro inventário rotativo.'}</div>
                          </div>
                        </td></tr>
                      )
                      : filteredInventarios.map(inv => {
                        const dur = calcDuration(inv)
                        const eff = calcEfficiency(inv)
                        return (
                          <tr
                            key={inv.id}
                            className={`inv-row${inv.id === newItemId ? ' row-new' : ''}`}
                            onClick={() => { setDrawerInv(inv); setOpenMenuId(null) }}
                          >
                            <td style={{ fontFamily: '"IBM Plex Mono",monospace', color: 'var(--color-brand-700)', fontWeight: 600, fontSize: 12 }}>#{inv.id}</td>
                            <td style={{ fontFamily: '"IBM Plex Mono",monospace', fontWeight: 700 }}>{inv.corredor}</td>
                            <td style={{ fontFamily: '"IBM Plex Mono",monospace', fontSize: 11 }}>{fmtDT(inv.iniciado_em)}</td>
                            <td style={{ fontFamily: '"IBM Plex Mono",monospace', fontSize: 11 }}>
                              {inv.concluido_em ? fmtDT(inv.concluido_em) : <span style={{ color: 'var(--color-text-tertiary)' }}>—</span>}
                            </td>
                            <td>
                              {dur === null
                                ? <span style={{ color: 'var(--color-text-tertiary)', fontSize: 12 }}>—</span>
                                : dur === 'em_andamento'
                                  ? <span className="badge badge-warning"><span className="live-dot" style={{ marginRight: 4 }} />Em andamento</span>
                                  : <span style={{ fontFamily: '"IBM Plex Mono",monospace', fontSize: 12 }}>{dur}</span>
                              }
                            </td>
                            <td style={{ textAlign: 'center' }}>{inv.total_itens || inv.total_posicoes || 0}</td>
                            <td style={{ textAlign: 'center' }}>{inv.total_conferidas || 0}</td>
                            <td style={{ textAlign: 'center' }}>{diffView(inv.total_divergencias ?? inv.divergencias ?? null)}</td>
                            <td>
                              <span style={{ fontFamily: '"IBM Plex Mono",monospace', fontWeight: 700, fontSize: 13 }}>
                                {Number(inv.acuracidade || 0).toFixed(1)}%
                              </span>
                            </td>
                            <td><EfficiencyBar pct={eff} /></td>
                            <td>{etapaBadge(inv.etapa || 'finalizado')}</td>
                            <td style={{ fontSize: 12 }}>{inv.usuario_nome || '—'}</td>
                            <td style={{ textAlign: 'right' }} onClick={e => e.stopPropagation()}>
                              <div className="inv-actions">
                                <button
                                  className="icon-btn"
                                  aria-label="Ações"
                                  onClick={() => setOpenMenuId(openMenuId === inv.id ? null : inv.id)}
                                >
                                  <MoreVertical size={14} />
                                </button>
                                {openMenuId === inv.id && (
                                  <div className="inv-menu">
                                    {(inv.etapa === 'iniciado' || inv.etapa === 'contando' || !inv.etapa) && (
                                      <button type="button" onClick={() => openInventory(inv, 'contagem')}>
                                        <ClipboardList size={13} />
                                        {inv.etapa === 'contando' ? 'Continuar Contagem' : 'Iniciar Contagem'}
                                      </button>
                                    )}
                                    {inv.etapa === 'confirmado' && user?.isAdmin && (
                                      <button type="button" onClick={() => openInventory(inv, 'confirmado')}>
                                        <CheckCircle size={13} /> Finalizar
                                      </button>
                                    )}
                                    {inv.etapa === 'finalizado' && (
                                      <button type="button" onClick={() => openInventory(inv, 'relatorio')}>
                                        <FileText size={13} /> Ver Relatório
                                      </button>
                                    )}
                                    <button type="button" onClick={() => { setOpenMenuId(null); toast.info('Exportação em breve.') }}>
                                      <Download size={13} /> Exportar CSV
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
                Exibindo {filteredInventarios.length} de {inventarios.length} inventários
              </span>
            </div>
          </div>
        </>
      )}

      {/* ═══════════════ CONTAGEM ═══════════════ */}
      {mode === 'contagem' && selected && (
        <>
          <div className="page-header">
            <div className="page-header-left">
              <button className="btn btn-outline btn-sm" onClick={() => { setMode('lista'); load() }}><ArrowLeft size={14} /> Voltar</button>
              <h1>Inventário #{selected.id} — Corredor {selected.corredor}</h1>
              <div className="subtitle">{etapaBadge(selected.etapa)} <span className="sep" /> {counted} de {items.length} itens conferidos</div>
            </div>
            <div className="page-header-actions">
              <button className="btn btn-outline" onClick={() => refreshSelected(selected.id)}>Salvar Progresso</button>
              <button className="btn btn-primary" disabled={!allCounted} onClick={() => setShowConfirm(true)}>Confirmar Inventário</button>
            </div>
          </div>
          <div style={{ height: 8, background: 'var(--color-bg-muted)', borderRadius: 999, overflow: 'hidden', marginBottom: 18 }}>
            <div style={{ width: `${items.length ? (counted / items.length) * 100 : 0}%`, height: '100%', background: 'var(--color-brand-600)', transition: 'width 150ms ease' }} />
          </div>
          <InventoryItemsTable items={items} updateLocalCount={updateLocalCount} saveCount={saveCount} />
          <Summary counted={counted} total={items.length} divergences={divergences.length} accuracy={accuracy} />
        </>
      )}

      {/* ═══════════════ CONFIRMADO ═══════════════ */}
      {mode === 'confirmado' && selected && (
        <ConfirmedView
          selected={selected}
          items={items}
          divergences={divergences}
          accuracy={accuracy}
          onBack={() => setMode('lista')}
          onFinalize={() => setShowFinalize(true)}
          canFinalize={Boolean(user?.isAdmin)}
        />
      )}

      {/* ═══════════════ RELATÓRIO ═══════════════ */}
      {mode === 'relatorio' && selected && (
        <ReportView
          selected={selected}
          items={items}
          counted={counted}
          divergences={divergences}
          accuracy={accuracy}
          onBack={() => setMode('lista')}
          onExport={exportCSV}
        />
      )}

      {/* ═══════════════ DRAWER LATERAL ═══════════════ */}
      {drawerInv && (
        <div
          className="inv-drawer-layer"
          onMouseDown={e => { if (e.target === e.currentTarget) setDrawerInv(null) }}
        >
          <aside className="inv-drawer" role="dialog" aria-label="Detalhes do inventário">
            <div className="inv-drawer-header">
              <div>
                <div className="inv-drawer-eyebrow">Inventário Rotativo</div>
                <h2>#{drawerInv.id}</h2>
                <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 8 }}>
                  {etapaBadge(drawerInv.etapa || 'finalizado')}
                  {drawerInv.corredor && (
                    <span style={{ fontFamily: '"IBM Plex Mono",monospace', fontSize: 12, color: 'var(--color-text-secondary)', fontWeight: 600 }}>
                      Corredor {drawerInv.corredor}
                    </span>
                  )}
                </div>
              </div>
              <button className="icon-btn" onClick={() => setDrawerInv(null)} aria-label="Fechar"><X size={15} /></button>
            </div>

            <div className="inv-drawer-body">
              <div className="inv-drawer-section-title">Resumo</div>
              {[
                ['Itens',         drawerInv.total_itens || drawerInv.total_posicoes || 0],
                ['Conferidos',    drawerInv.total_conferidas || 0],
                ['Divergências',  drawerInv.total_divergencias ?? drawerInv.divergencias ?? 0],
                ['Acuracidade',   `${Number(drawerInv.acuracidade || 0).toFixed(1)}%`],
                ['Operador',      drawerInv.usuario_nome || '—'],
                ['Início',        fmtDT(drawerInv.iniciado_em)],
                ['Término',       drawerInv.concluido_em ? fmtDT(drawerInv.concluido_em) : '—'],
                ['Duração',       (() => { const d = calcDuration(drawerInv); return d === 'em_andamento' ? 'Em andamento' : d || '—' })()],
              ].map(([label, value]) => (
                <div key={label} className="inv-drawer-row">
                  <span>{label}</span>
                  <strong>{value}</strong>
                </div>
              ))}

              <div className="inv-drawer-section-title" style={{ marginTop: 18, paddingTop: 14, borderTop: '1px solid var(--color-border-default)' }}>Timeline</div>
              {(() => {
                const tlEvents = buildTimeline(drawerInv)
                return tlEvents.length === 0
                  ? <div className="inv-timeline-empty">Sem eventos registrados.</div>
                  : tlEvents.map((ev, i) => (
                    <div key={i} className="inv-timeline-item">
                      <span>{ev.ts ? fmtDT(ev.ts) : '—'}</span>
                      <strong>{ev.label}</strong>
                      {ev.op && <small>{ev.op}</small>}
                    </div>
                  ))
              })()}
            </div>

            <div className="inv-drawer-actions">
              {(drawerInv.etapa === 'iniciado' || drawerInv.etapa === 'contando' || !drawerInv.etapa) && (
                <button className="btn btn-primary" onClick={() => openInventory(drawerInv, 'contagem')}>
                  {drawerInv.etapa === 'contando' ? 'Continuar Contagem' : 'Iniciar Contagem'}
                </button>
              )}
              {drawerInv.etapa === 'confirmado' && (user?.isAdmin
                ? <button className="btn btn-primary" onClick={() => openInventory(drawerInv, 'confirmado')}>Finalizar</button>
                : <FinalizeHint />
              )}
              {drawerInv.etapa === 'finalizado' && (
                <button className="btn btn-outline" onClick={() => openInventory(drawerInv, 'relatorio')}>Ver Relatório</button>
              )}
            </div>
          </aside>
        </div>
      )}

      {/* ═══════════════ MODALS (unchanged) ═══════════════ */}
      {showCreate && (
        <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && setShowCreate(false)}>
          <div className="modal" style={{ maxWidth: 520 }}>
            <div className="modal-header">
              <h3 className="modal-title">Iniciar Inventário</h3>
              <button className="icon-btn" onClick={() => setShowCreate(false)}><X size={16} /></button>
            </div>
            <form onSubmit={startInventory}>
              <div className="modal-body">
                <div className="form-group input-float">
                  <select className="select" value={form.corredor} onChange={e => setForm(f => ({ ...f, corredor: e.target.value }))} required>
                    {corredores.map(c => <option key={c}>{c}</option>)}
                  </select>
                  <label>Corredor *</label>
                </div>
                <div className="form-group input-float">
                  <select className="select" value={form.id_usuario} onChange={e => setForm(f => ({ ...f, id_usuario: e.target.value }))} required>
                    {usuarios.map(u => <option key={u.id} value={u.id}>{u.nome}</option>)}
                  </select>
                  <label>Operador *</label>
                </div>
                <div style={{ background: 'var(--color-info-50)', border: '1px solid var(--color-info-100)', borderRadius: 8, padding: 12, fontSize: 12, color: 'var(--color-info-700)' }}>
                  Serão incluídos todos os lotes ativos do corredor {form.corredor || '-'}.
                  <br />Total de lotes a conferir: <strong>{createCount}</strong>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={() => setShowCreate(false)}>Cancelar</button>
                <button type="submit" className={`btn btn-primary ${actionLoading === 'create' ? 'btn-loading' : ''}`} disabled={actionLoading === 'create'}>Iniciar Inventario</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showConfirm && (
        <DivergenceModal
          title={`Confirmar Inventário #${selected.id}`}
          items={divergences}
          onCancel={() => setShowConfirm(false)}
          onConfirm={confirmInventory}
          confirmLabel="Confirmar"
          loading={actionLoading === 'confirm'}
        />
      )}

      {showFinalize && user?.isAdmin && (
        <DivergenceModal
          danger
          title="Finalizar e aplicar ajustes"
          items={divergences}
          onCancel={() => setShowFinalize(false)}
          onConfirm={finalizeInventory}
          loading={actionLoading === 'finalize'}
          confirmLabel="Finalizar Inventário"
        />
      )}

      {/* ═══════════════ STYLES ═══════════════ */}
      <style>{`
        @keyframes inv-drawer-in { from{opacity:0;transform:translateX(16px)} to{opacity:1;transform:translateX(0)} }

        /* KPI Strip */
        .inv-kpi-grid { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:12px; margin-bottom:16px }
        .inv-kpi-card { display:flex; align-items:center; gap:12px; min-height:74px; padding:12px 14px; background:var(--color-bg-default); border:1px solid var(--color-border-default); border-radius:var(--radius-md); box-shadow:var(--shadow-xs) }
        .inv-kpi-icon { width:30px; height:30px; display:grid; place-items:center; background:var(--color-bg-subtle); border:1px solid var(--color-border-muted); border-radius:var(--radius-sm); flex-shrink:0 }
        .inv-kpi-label { font-size:10px; font-weight:700; color:var(--color-text-tertiary); text-transform:uppercase; letter-spacing:0.08em }
        .inv-kpi-value { margin-top:2px; font-size:26px; line-height:1; font-weight:800; color:var(--color-text-primary); font-variant-numeric:tabular-nums }

        /* Filter strip */
        .inv-filter-strip { display:flex; gap:8px; padding:10px 20px; border-bottom:1px solid var(--color-border-default); background:var(--color-bg-elevated); flex-wrap:wrap }
        .inv-filter-chip { display:inline-flex; align-items:center; gap:6px; height:28px; padding:0 10px; border:1px solid var(--color-border-default); border-radius:6px; background:var(--color-bg-default); color:var(--color-text-secondary); font-size:12px; font-weight:700; cursor:pointer; transition:background 100ms,border-color 100ms,color 100ms }
        .inv-filter-chip span { color:var(--color-text-tertiary); font-variant-numeric:tabular-nums }
        .inv-filter-chip:hover,.inv-filter-chip.active { background:var(--color-bg-subtle); border-color:var(--color-border-strong); color:var(--color-text-primary) }

        /* Table overrides */
        .inv-table-scroll { overflow-x:auto; max-height:calc(100vh - 420px) }
        .inv-table thead th { position:sticky; top:0; z-index:2; background:var(--color-bg-elevated) }
        .inv-row { cursor:pointer; transition:background 80ms }
        .inv-row:hover { background:var(--color-bg-subtle) }

        /* Context menu */
        .inv-actions { position:relative; display:inline-flex; justify-content:flex-end }
        .inv-menu { position:absolute; right:0; top:34px; z-index:10; min-width:190px; padding:6px; background:var(--color-bg-default); border:1px solid var(--color-border-default); border-radius:var(--radius-md); box-shadow:var(--shadow-md) }
        .inv-menu button { width:100%; display:flex; align-items:center; gap:8px; min-height:30px; padding:0 8px; border-radius:5px; color:var(--color-text-secondary); font-size:12px; font-weight:600; text-align:left }
        .inv-menu button:hover { background:var(--color-bg-subtle); color:var(--color-text-primary) }

        /* Drawer */
        .inv-drawer-layer { position:fixed; inset:0; z-index:30; display:flex; justify-content:flex-end; background:transparent }
        .inv-drawer { width:min(480px,100%); height:100%; background:var(--color-bg-default); border-left:1px solid var(--color-border-default); box-shadow:var(--shadow-lg); animation:inv-drawer-in 160ms ease-out; display:flex; flex-direction:column }
        .inv-drawer-header { display:flex; justify-content:space-between; gap:16px; padding:20px; border-bottom:1px solid var(--color-border-default); background:var(--color-bg-elevated) }
        .inv-drawer-eyebrow { color:var(--color-text-tertiary); font-size:10px; font-weight:800; letter-spacing:0.08em; text-transform:uppercase }
        .inv-drawer h2 { margin:4px 0 0; color:var(--color-text-primary); font-family:"IBM Plex Mono",monospace; font-size:20px }
        .inv-drawer-body { flex:1; overflow:auto; padding:16px 20px }
        .inv-drawer-section-title { font-size:11px; font-weight:800; text-transform:uppercase; letter-spacing:0.07em; color:var(--color-text-tertiary); margin-bottom:8px }
        .inv-drawer-row { display:flex; justify-content:space-between; gap:16px; padding:10px 0; border-bottom:1px solid var(--color-border-muted); font-size:13px }
        .inv-drawer-row span { color:var(--color-text-tertiary) }
        .inv-drawer-row strong { color:var(--color-text-primary); text-align:right; font-weight:700 }
        .inv-timeline-item { display:grid; grid-template-columns:140px 1fr; gap:4px 10px; padding:9px 0; border-bottom:1px solid var(--color-border-muted); font-size:12px }
        .inv-timeline-item span { color:var(--color-text-tertiary); font-family:"IBM Plex Mono",monospace }
        .inv-timeline-item strong { color:var(--color-text-primary) }
        .inv-timeline-item small { grid-column:2; color:var(--color-text-tertiary) }
        .inv-timeline-empty { color:var(--color-text-tertiary); font-size:13px; padding:12px 0 }
        .inv-drawer-actions { display:flex; gap:8px; padding:14px 20px; border-top:1px solid var(--color-border-default); flex-wrap:wrap }

        @media(max-width:1180px) { .inv-kpi-grid{grid-template-columns:repeat(2,minmax(0,1fr))} }
        @media(max-width:700px)  { .inv-kpi-grid{grid-template-columns:1fr} .inv-table-scroll{max-height:none} .inv-drawer-actions .btn{width:100%;justify-content:center} }
      `}</style>
    </Layout>
  )
}

/* ─── Sub-components (modes contagem / confirmado / relatorio) ── */
function InventoryItemsTable({ items, updateLocalCount, saveCount }) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Lote</th><th>Produto</th><th>Localização</th>
            <th style={{ textAlign: 'right' }}>Qtd Sistema</th>
            <th>Qtd Contada</th><th>Divergência</th>
          </tr>
        </thead>
        <tbody>
          {items.map(item => (
            <tr key={item.id_lote} style={{ background: rowBg(item) }}>
              <td style={{ fontFamily: '"IBM Plex Mono",monospace', fontWeight: 600 }}>{item.numero_lote}</td>
              <td>{item.produto_nome}</td>
              <td style={{ fontFamily: '"IBM Plex Mono",monospace', fontSize: 12 }}>{item.localizacao}</td>
              <td style={{ textAlign: 'right', fontWeight: 700 }}>{item.qtd_sistema}</td>
              <td>
                <input
                  className="input"
                  type="number"
                  min="0"
                  value={item.qtd_contada ?? ''}
                  onChange={e => updateLocalCount(item.id_lote, e.target.value)}
                  onBlur={() => saveCount(item)}
                  style={{ width: 120 }}
                />
              </td>
              <td>{diffView(item.divergencia)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function Summary({ counted, total, divergences, accuracy }) {
  return (
    <div className="card" style={{ padding: 16, marginTop: 16, fontSize: 13 }}>
      Itens conferidos: <strong>{counted}/{total}</strong> | Divergências: <strong>{divergences}</strong> | Acuracidade estimada: <strong>{accuracy}%</strong>
    </div>
  )
}

function DivergenceModal({ title, items, onCancel, onConfirm, confirmLabel, danger, loading }) {
  return (
    <div className="modal-backdrop">
      <div className="modal" style={{ maxWidth: 720 }}>
        <div className="modal-header">
          <h3 className="modal-title">{title}</h3>
          <button className="icon-btn" onClick={onCancel}><X size={16} /></button>
        </div>
        <div className="modal-body">
          {items.length === 0
            ? <div style={{ color: 'var(--color-success-700)', fontWeight: 700 }}><CheckCircle size={16} /> Nenhuma divergência encontrada.</div>
            : (
              <table>
                <thead><tr><th>Lote</th><th>Produto</th><th>Esperado</th><th>Contado</th><th>Diferença</th></tr></thead>
                <tbody>
                  {items.map(i => (
                    <tr key={i.id_lote}>
                      <td>{i.numero_lote}</td><td>{i.produto_nome}</td>
                      <td>{i.qtd_sistema}</td><td>{i.qtd_contada}</td>
                      <td>{diffView(i.divergencia)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
          }
          <div style={{ marginTop: 14, padding: 12, borderRadius: 8, background: danger ? 'var(--color-danger-50)' : 'var(--color-info-50)', color: danger ? 'var(--color-danger-700)' : 'var(--color-info-700)', fontSize: 12 }}>
            {danger
              ? 'Esta ação é irreversível. Os ajustes serão aplicados no estoque.'
              : 'Ao confirmar, as divergências serão registradas. O estoque será ajustado apenas ao Finalizar.'}
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-outline" onClick={onCancel}>Voltar e Corrigir</button>
          <button className={`btn ${danger ? 'btn-danger' : 'btn-primary'} ${loading ? 'btn-loading' : ''}`} onClick={onConfirm} disabled={loading}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  )
}

function FinalizeHint() {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--color-text-secondary)' }}>
      <ShieldCheck size={14} /> Somente administradores podem finalizar e aplicar ajustes.
    </span>
  )
}

function ConfirmedView({ selected, items, divergences, accuracy, onBack, onFinalize, canFinalize }) {
  return (
    <>
      <div className="page-header">
        <div className="page-header-left">
          <button className="btn btn-outline btn-sm" onClick={onBack}><ArrowLeft size={14} /> Voltar</button>
          <h1>Inventário #{selected.id} confirmado</h1>
          <div className="subtitle">{etapaBadge('confirmado')} <span className="sep" /> {divergences.length} divergências</div>
        </div>
        <div className="page-header-actions">
          {canFinalize
            ? <button className="btn btn-danger" onClick={onFinalize}><AlertTriangle size={14} /> Finalizar e Aplicar Ajustes</button>
            : <FinalizeHint />}
        </div>
      </div>
      <Summary counted={items.length} total={items.length} divergences={divergences.length} accuracy={accuracy} />
      <InventoryItemsTable items={items} updateLocalCount={() => {}} saveCount={() => {}} />
    </>
  )
}

function ReportView({ selected, items, counted, divergences, accuracy, onBack, onExport }) {
  return (
    <>
      <div className="page-header">
        <div className="page-header-left">
          <button className="btn btn-outline btn-sm" onClick={onBack}><ArrowLeft size={14} /> Voltar</button>
          <h1>Relatório Inventário #{selected.id}</h1>
          <div className="subtitle">{selected.corredor} <span className="sep" /> {selected.usuario_nome || '-'}</div>
        </div>
        <div className="page-header-actions">
          <button className="btn btn-outline" onClick={onExport}><Download size={14} /> Exportar CSV</button>
        </div>
      </div>
      <div className="summary-grid" style={{ gridTemplateColumns: 'repeat(4,1fr)', marginBottom: 18 }}>
        {[['Total itens', items.length], ['Conferidos', counted], ['Divergências', divergences.length], ['Acuracidade', `${accuracy}%`]]
          .map(([l, v]) => (
            <div className="summary-card" key={l}>
              <div className="label">{l}</div>
              <div className="value">{v}</div>
            </div>
          ))}
      </div>
      <InventoryItemsTable items={items} updateLocalCount={() => {}} saveCount={() => {}} />
    </>
  )
}



