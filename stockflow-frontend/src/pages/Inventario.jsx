import { useEffect, useMemo, useState } from 'react'
import Layout from '../components/Layout.jsx'
import { useToast } from '../context/ToastContext.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import api from '../api/axios.js'
import { Plus, ClipboardList, CheckCircle, AlertTriangle, FileText, ArrowLeft, X, Download } from 'lucide-react'

const ETAPA = {
  iniciado: { label: 'Iniciado', cls: 'badge-info' },
  contando: { label: 'Em contagem', cls: 'badge-warning' },
  confirmado: { label: 'Confirmado', cls: 'badge-admin' },
  finalizado: { label: 'Finalizado', cls: 'badge-success' },
}

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

export default function Inventario() {
  const toast = useToast()
  const { user } = useAuth()
  const [inventarios, setInventarios] = useState([])
  const [selected, setSelected] = useState(null)
  const [mode, setMode] = useState('lista')
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [showFinalize, setShowFinalize] = useState(false)
  const [corredores, setCorredores] = useState([])
  const [usuarios, setUsuarios] = useState([])
  const [lotes, setLotes] = useState([])
  const [form, setForm] = useState({ corredor: '', id_usuario: '' })
  const [counts, setCounts] = useState({})

  useEffect(() => { load() }, [])

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
      const locs = locRes.status === 'fulfilled' ? (locRes.value.data.data || locRes.value.data || []) : []
      const lots = loteRes.status === 'fulfilled' ? (loteRes.value.data.data || []) : []
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

  async function startInventory(e) {
    e.preventDefault()
    try {
      const { data } = await api.post('/inventario', {
        corredor: form.corredor,
        id_usuario: form.id_usuario ? Number(form.id_usuario) : undefined,
      })
      toast.success('Inventário iniciado.')
      setShowCreate(false)
      setSelected(data)
      setMode('contagem')
      load()
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erro ao iniciar inventário.')
    }
  }

  async function openInventory(inv, nextMode) {
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
    try {
      const { data } = await api.patch(`/inventario/${selected.id}/confirmar`)
      setSelected(data)
      setShowConfirm(false)
      setMode('confirmado')
      toast.success('Inventário confirmado.')
      load()
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erro ao confirmar inventário.')
    }
  }

  async function finalizeInventory() {
    try {
      const { data } = await api.patch(`/inventario/${selected.id}/finalizar`)
      setSelected(data)
      setShowFinalize(false)
      setMode('relatorio')
      toast.success('Inventário finalizado e estoque ajustado.')
      load()
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erro ao finalizar inventário.')
    }
  }

  function exportCSV() {
    const rows = items.map(i => [i.numero_lote, i.produto_nome, i.localizacao, i.qtd_sistema, i.qtd_contada ?? '', i.divergencia ?? ''])
    const csv = [['Lote', 'Produto', 'Localizacao', 'Qtd Sistema', 'Qtd Contada', 'Divergencia'], ...rows].map(r => r.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `inventario-${selected?.id || 'relatorio'}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const items = parseItems(selected)
  const counted = items.filter(i => i.qtd_contada !== null && i.qtd_contada !== undefined).length
  const divergences = items.filter(i => Number(i.divergencia || 0) !== 0)
  const accuracy = items.length ? (((items.length - divergences.length) / items.length) * 100).toFixed(1) : '100.0'
  const allCounted = items.length > 0 && counted === items.length

  const createCount = form.corredor ? (counts[form.corredor] || 0) : 0

  return (
    <Layout breadcrumb={['Movimentações', 'Inventário']}>
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

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>ID</th><th>Corredor</th><th>Início</th><th>Término</th><th>Itens</th><th>Conf.</th><th>Diverg.</th><th>Acuracidade</th><th>Status</th><th>Operador</th><th style={{ textAlign: 'right' }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={11}>Carregando...</td></tr>
                ) : inventarios.length === 0 ? (
                  <tr><td colSpan={11}><div className="empty-state"><div className="empty-icon"><ClipboardList size={24} /></div><div className="empty-title">Nenhum inventário encontrado</div></div></td></tr>
                ) : inventarios.map(inv => (
                  <tr key={inv.id}>
                    <td style={{ fontFamily: '"IBM Plex Mono",monospace' }}>#{inv.id}</td>
                    <td>{inv.corredor}</td>
                    <td>{inv.iniciado_em ? new Date(inv.iniciado_em).toLocaleString('pt-BR') : '-'}</td>
                    <td>{inv.concluido_em ? new Date(inv.concluido_em).toLocaleString('pt-BR') : '-'}</td>
                    <td>{inv.total_itens || inv.total_posicoes || 0}</td>
                    <td>{inv.total_conferidas || 0}</td>
                    <td>{inv.total_divergencias ?? inv.divergencias ?? 0}</td>
                    <td>{Number(inv.acuracidade || 0).toFixed(1)}%</td>
                    <td>{etapaBadge(inv.etapa || 'finalizado')}</td>
                    <td>{inv.usuario_nome || '-'}</td>
                    <td style={{ textAlign: 'right' }}>
                      {(inv.etapa === 'iniciado' || !inv.etapa) && <button className="btn btn-sm btn-primary" onClick={() => openInventory(inv, 'contagem')}>Iniciar Contagem</button>}
                      {inv.etapa === 'contando' && <button className="btn btn-sm btn-primary" onClick={() => openInventory(inv, 'contagem')}>Continuar</button>}
                      {inv.etapa === 'confirmado' && <button className="btn btn-sm btn-outline" onClick={() => openInventory(inv, 'confirmado')}>Finalizar</button>}
                      {inv.etapa === 'finalizado' && <button className="btn btn-sm btn-outline" onClick={() => openInventory(inv, 'relatorio')}>Ver Relatório</button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

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

      {mode === 'confirmado' && selected && (
        <ConfirmedView selected={selected} items={items} divergences={divergences} accuracy={accuracy} onBack={() => setMode('lista')} onFinalize={() => setShowFinalize(true)} />
      )}

      {mode === 'relatorio' && selected && (
        <ReportView selected={selected} items={items} counted={counted} divergences={divergences} accuracy={accuracy} onBack={() => setMode('lista')} onExport={exportCSV} />
      )}

      {showCreate && (
        <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && setShowCreate(false)}>
          <div className="modal" style={{ maxWidth: 520 }}>
            <div className="modal-header"><h3 className="modal-title">Iniciar Inventário</h3><button className="icon-btn" onClick={() => setShowCreate(false)}><X size={16} /></button></div>
            <form onSubmit={startInventory}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Corredor *</label>
                  <select className="select" value={form.corredor} onChange={e => setForm(f => ({ ...f, corredor: e.target.value }))} required>
                    {corredores.map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Operador *</label>
                  <select className="select" value={form.id_usuario} onChange={e => setForm(f => ({ ...f, id_usuario: e.target.value }))} required>
                    {usuarios.map(u => <option key={u.id} value={u.id}>{u.nome}</option>)}
                  </select>
                </div>
                <div style={{ background: 'var(--color-info-50)', border: '1px solid var(--color-info-100)', borderRadius: 8, padding: 12, fontSize: 12, color: 'var(--color-info-700)' }}>
                  Serão incluídos todos os lotes ativos do corredor {form.corredor || '-'}.
                  <br />Total de lotes a conferir: <strong>{createCount}</strong>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={() => setShowCreate(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary">Iniciar Inventário</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showConfirm && (
        <DivergenceModal title={`Confirmar Inventário #${selected.id}`} items={divergences} onCancel={() => setShowConfirm(false)} onConfirm={confirmInventory} confirmLabel="Confirmar" />
      )}

      {showFinalize && (
        <DivergenceModal danger title="Finalizar e aplicar ajustes" items={divergences} onCancel={() => setShowFinalize(false)} onConfirm={finalizeInventory} confirmLabel="Finalizar Inventário" />
      )}
    </Layout>
  )
}

function InventoryItemsTable({ items, updateLocalCount, saveCount }) {
  return (
    <div className="table-wrap">
      <table>
        <thead><tr><th>Lote</th><th>Produto</th><th>Localização</th><th style={{ textAlign: 'right' }}>Qtd Sistema</th><th>Qtd Contada</th><th>Divergência</th></tr></thead>
        <tbody>
          {items.map(item => (
            <tr key={item.id_lote} style={{ background: rowBg(item) }}>
              <td style={{ fontFamily: '"IBM Plex Mono",monospace', fontWeight: 600 }}>{item.numero_lote}</td>
              <td>{item.produto_nome}</td>
              <td style={{ fontFamily: '"IBM Plex Mono",monospace', fontSize: 12 }}>{item.localizacao}</td>
              <td style={{ textAlign: 'right', fontWeight: 700 }}>{item.qtd_sistema}</td>
              <td><input className="input" type="number" min="0" value={item.qtd_contada ?? ''} onChange={e => updateLocalCount(item.id_lote, e.target.value)} onBlur={() => saveCount(item)} style={{ width: 120 }} /></td>
              <td>{diffView(item.divergencia)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function Summary({ counted, total, divergences, accuracy }) {
  return <div className="card" style={{ padding: 16, marginTop: 16, fontSize: 13 }}>Itens conferidos: <strong>{counted}/{total}</strong> | Divergências: <strong>{divergences}</strong> | Acuracidade estimada: <strong>{accuracy}%</strong></div>
}

function DivergenceModal({ title, items, onCancel, onConfirm, confirmLabel, danger }) {
  return (
    <div className="modal-backdrop">
      <div className="modal" style={{ maxWidth: 720 }}>
        <div className="modal-header"><h3 className="modal-title">{title}</h3><button className="icon-btn" onClick={onCancel}><X size={16} /></button></div>
        <div className="modal-body">
          {items.length === 0 ? (
            <div style={{ color: 'var(--color-success-700)', fontWeight: 700 }}><CheckCircle size={16} /> Nenhuma divergência encontrada.</div>
          ) : (
            <table><thead><tr><th>Lote</th><th>Produto</th><th>Esperado</th><th>Contado</th><th>Diferença</th></tr></thead><tbody>{items.map(i => <tr key={i.id_lote}><td>{i.numero_lote}</td><td>{i.produto_nome}</td><td>{i.qtd_sistema}</td><td>{i.qtd_contada}</td><td>{diffView(i.divergencia)}</td></tr>)}</tbody></table>
          )}
          <div style={{ marginTop: 14, padding: 12, borderRadius: 8, background: danger ? 'var(--color-danger-50)' : 'var(--color-info-50)', color: danger ? 'var(--color-danger-700)' : 'var(--color-info-700)', fontSize: 12 }}>
            {danger ? 'Esta ação é irreversível. Os ajustes serão aplicados no estoque.' : 'Ao confirmar, as divergências serão registradas. O estoque será ajustado apenas ao Finalizar.'}
          </div>
        </div>
        <div className="modal-footer"><button className="btn btn-outline" onClick={onCancel}>Voltar e Corrigir</button><button className={`btn ${danger ? 'btn-danger' : 'btn-primary'}`} onClick={onConfirm}>{confirmLabel}</button></div>
      </div>
    </div>
  )
}

function ConfirmedView({ selected, items, divergences, accuracy, onBack, onFinalize }) {
  return (
    <>
      <div className="page-header"><div className="page-header-left"><button className="btn btn-outline btn-sm" onClick={onBack}><ArrowLeft size={14} /> Voltar</button><h1>Inventário #{selected.id} confirmado</h1><div className="subtitle">{etapaBadge('confirmado')} <span className="sep" /> {divergences.length} divergências</div></div><div className="page-header-actions"><button className="btn btn-danger" onClick={onFinalize}><AlertTriangle size={14} /> Finalizar e Aplicar Ajustes</button></div></div>
      <Summary counted={items.length} total={items.length} divergences={divergences.length} accuracy={accuracy} />
      <InventoryItemsTable items={items} updateLocalCount={() => {}} saveCount={() => {}} />
    </>
  )
}

function ReportView({ selected, items, counted, divergences, accuracy, onBack, onExport }) {
  return (
    <>
      <div className="page-header"><div className="page-header-left"><button className="btn btn-outline btn-sm" onClick={onBack}><ArrowLeft size={14} /> Voltar</button><h1>Relatório Inventário #{selected.id}</h1><div className="subtitle">{selected.corredor} <span className="sep" /> {selected.usuario_nome || '-'}</div></div><div className="page-header-actions"><button className="btn btn-outline" onClick={onExport}><Download size={14} /> Exportar CSV</button></div></div>
      <div className="summary-grid" style={{ gridTemplateColumns: 'repeat(4,1fr)', marginBottom: 18 }}>
        {[['Total itens', items.length], ['Conferidos', counted], ['Divergências', divergences.length], ['Acuracidade', `${accuracy}%`]].map(([l, v]) => <div className="summary-card" key={l}><div className="label">{l}</div><div className="value">{v}</div></div>)}
      </div>
      <InventoryItemsTable items={items} updateLocalCount={() => {}} saveCount={() => {}} />
    </>
  )
}
