import { useMemo, useRef, useState, useEffect } from 'react'
import Layout from '../components/Layout.jsx'
import { useToast } from '../context/ToastContext.jsx'
import api from '../api/axios.js'
import {
  Plus, Upload, Download, Search, Eye, Package, CheckCircle, X,
  AlertTriangle, Boxes, Tags, MoreVertical, Activity, Clock,
  ArrowUp, ArrowDown, ShieldCheck,
} from 'lucide-react'

function StatusBadge({ status, estoque, minimo }) {
  if (!status) {
    if (estoque === 0) return <span className="badge badge-neutral">Inativo</span>
    if (estoque < minimo) return <span className="badge badge-danger">Crítico</span>
    return <span className="badge badge-success">Ativo</span>
  }
  const map = { ativo: 'badge-success', inativo: 'badge-neutral', critico: 'badge-danger' }
  return <span className={`badge ${map[status.toLowerCase()] || 'badge-neutral'}`}>{status}</span>
}

function getTipo(categoria) {
  return ({
    'Pães': { label: 'Congelado', color: 'info' },
    'Salgados': { label: 'Congelado', color: 'info' },
    'Quitandas': { label: 'Resfriado', color: 'neutral' },
    'Massas': { label: 'Pré-preparo', color: 'neutral' },
  }[categoria] || { label: 'Padrão', color: 'neutral' })
}

function isActive(p) {
  return Number(p.ativo) !== 0
}

function isCritical(p) {
  return isActive(p) && Number(p.estoque_atual || 0) < Number(p.estoque_minimo || 0)
}

function isOutOfStock(p) {
  return isActive(p) && Number(p.estoque_atual || 0) === 0
}

function getHealthScore(p) {
  if (!isActive(p)) return 40
  const estoque = Number(p.estoque_atual || 0)
  const minimo = Number(p.estoque_minimo || 0)
  if (minimo <= 0) return estoque > 0 ? 95 : 70
  const ratio = estoque / minimo
  if (ratio >= 1.5) return 95
  if (ratio >= 1) return 82
  if (ratio > 0) return 58
  return 28
}

function getHealthTone(score) {
  if (score >= 90) return 'success'
  if (score >= 70) return 'warning'
  return 'danger'
}

function getCoverageLabel(value) {
  return value ? `${value} dias` : '-'
}

function getLastMovementLabel(value) {
  if (!value) return '-'
  return '-'
}

function getProductId(p) {
  return p.id_produto || p.id
}

function csvValue(value) {
  const text = String(value ?? '')
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

function parseCSVLine(line) {
  const cells = []
  let current = ''
  let quoted = false
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i]
    if (ch === '"' && line[i + 1] === '"') {
      current += '"'
      i += 1
    } else if (ch === '"') {
      quoted = !quoted
    } else if (ch === ',' && !quoted) {
      cells.push(current.trim())
      current = ''
    } else {
      current += ch
    }
  }
  cells.push(current.trim())
  return cells
}

function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = reject
    reader.readAsText(file)
  })
}

function SkeletonRow() {
  return (
    <tr>
      {Array.from({ length: 13 }).map((_, i) => (
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
    <div className="products-kpi-card">
      <div className="products-kpi-icon" style={{ color }}><Icon size={16} /></div>
      <div>
        <div className="products-kpi-label">{label}</div>
        <div className="products-kpi-value">{value}</div>
      </div>
    </div>
  )
}

function HealthScore({ score }) {
  const tone = getHealthTone(score)
  return <span className={`product-health product-health-${tone}`}>{score}</span>
}

export default function Produtos() {
  const toast = useToast()
  const fileRef = useRef(null)
  const [produtos, setProdutos] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [importing, setImporting] = useState('')
  const [quickFilter, setQuickFilter] = useState('todos')
  const [sort, setSort] = useState({ key: 'nome', dir: 'asc' })
  const [selectedProduct, setSelectedProduct] = useState(null)
  const [openMenuId, setOpenMenuId] = useState(null)
  const [newProductId, setNewProductId] = useState(null)
  const [form, setForm] = useState({ nome: '', categoria: 'Pães', unidade_medida: 'unidade', estoque_minimo: '' })

  useEffect(() => { load() }, [])

  useEffect(() => {
    function onKeyDown(e) {
      if (e.key === 'Escape') {
        setSelectedProduct(null)
        setOpenMenuId(null)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  async function load() {
    setLoading(true)
    try {
      const { data } = await api.get('/produtos', { params: { limit: 500 } })
      setProdutos(data.data || [])
      setTotal(data.total || 0)
    } catch {
      toast.error('Erro ao carregar produtos.')
    } finally {
      setLoading(false)
    }
  }

  function exportCSV() {
    const headers = ['ID', 'Nome', 'Categoria', 'Tipo', 'Unidade', 'Est.Atual', 'Est.Minimo', 'Status']
    const rows = produtos.map(p => [
      p.id_produto || p.id,
      p.nome,
      p.categoria,
      getTipo(p.categoria).label,
      p.unidade_medida,
      p.estoque_atual,
      p.estoque_minimo,
      p.ativo ? 'Ativo' : 'Inativo',
    ])
    const csv = [headers, ...rows].map(r => r.map(csvValue).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `produtos-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  async function handleImportCSV(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return

    const text = await readFileAsText(file)
    const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean).slice(1)
    const rows = lines.map(parseCSVLine).filter(r => r.length >= 4)
    if (!rows.length) {
      toast.error('CSV sem linhas válidas.')
      return
    }

    let ok = 0
    for (let i = 0; i < rows.length; i += 1) {
      const [nome, categoria, unidade_medida, estoque_minimo] = rows[i]
      setImporting(`Importando ${i + 1} de ${rows.length} produtos...`)
      if (!nome || !categoria || !unidade_medida) {
        toast.error(`Linha ${i + 2} inválida.`)
        continue
      }
      try {
        await api.post('/produtos', { nome, categoria, unidade_medida, estoque_minimo: Number(estoque_minimo || 0) })
        ok += 1
      } catch (err) {
        toast.error(`Linha ${i + 2}: ${err.response?.data?.error || 'erro ao importar'}`)
      }
    }
    setImporting('')
    toast.success(`${ok} produtos importados com sucesso!`)
    load()
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setSubmitting(true)
    try {
      const { data } = await api.post('/produtos', { ...form, estoque_minimo: Number(form.estoque_minimo || 0) })
      const createdId = data?.data?.id_produto || data?.data?.id || data?.id_produto || data?.id
      if (createdId) {
        setNewProductId(createdId)
        setTimeout(() => setNewProductId(null), 2000)
      }
      toast.success('Produto cadastrado com sucesso!')
      setShowForm(false)
      setForm({ nome: '', categoria: 'Pães', unidade_medida: 'unidade', estoque_minimo: '' })
      load()
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erro ao cadastrar produto.')
    } finally {
      setSubmitting(false)
    }
  }

  const enrichedProdutos = useMemo(() => produtos.map(p => ({
    ...p,
    tipoInfo: getTipo(p.categoria),
    healthScore: getHealthScore(p),
    coberturaDias: null,
    curvaAbc: null,
    ultimaMovimentacao: null,
  })), [produtos])

  const kpis = useMemo(() => ({
    ativos: enrichedProdutos.filter(isActive).length,
    criticos: enrichedProdutos.filter(isCritical).length,
    semEstoque: enrichedProdutos.filter(isOutOfStock).length,
    categorias: new Set(enrichedProdutos.map(p => p.categoria).filter(Boolean)).size,
  }), [enrichedProdutos])

  const filterCounts = useMemo(() => ({
    todos: enrichedProdutos.length,
    criticos: enrichedProdutos.filter(isCritical).length,
    sem_estoque: enrichedProdutos.filter(isOutOfStock).length,
    abaixo_minimo: enrichedProdutos.filter(isCritical).length,
    inativos: enrichedProdutos.filter(p => !isActive(p)).length,
  }), [enrichedProdutos])

  const filteredProdutos = useMemo(() => {
    const q = search.trim().toLowerCase()
    const byFilter = enrichedProdutos.filter(p => {
      if (quickFilter === 'criticos') return isCritical(p)
      if (quickFilter === 'sem_estoque') return isOutOfStock(p)
      if (quickFilter === 'abaixo_minimo') return isCritical(p)
      if (quickFilter === 'inativos') return !isActive(p)
      return true
    })

    const bySearch = byFilter.filter(p => {
      if (!q) return true
      return [p.nome, p.codigo, p.id, p.categoria, p.tipoInfo?.label]
        .some(value => String(value || '').toLowerCase().includes(q))
    })

    const dir = sort.dir === 'asc' ? 1 : -1
    return [...bySearch].sort((a, b) => {
      const values = {
        codigo: [a.codigo || a.id || '', b.codigo || b.id || ''],
        nome: [a.nome || '', b.nome || ''],
        categoria: [a.categoria || '', b.categoria || ''],
        estoque: [Number(a.estoque_atual || 0), Number(b.estoque_atual || 0)],
        minimo: [Number(a.estoque_minimo || 0), Number(b.estoque_minimo || 0)],
        cobertura: [Number(a.coberturaDias || -1), Number(b.coberturaDias || -1)],
      }[sort.key] || ['', '']
      const [av, bv] = values
      if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * dir
      return String(av).localeCompare(String(bv), 'pt-BR') * dir
    })
  }, [enrichedProdutos, quickFilter, search, sort])

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
    <Layout breadcrumb={['Operação', 'Produtos']}>
      <div className="page-header">
        <div className="page-header-left">
          <h1>Produtos</h1>
          <div className="subtitle">
            <span>Central inteligente de gestao de produtos</span>
            {importing && <><span className="sep" /><span>{importing}</span></>}
          </div>
        </div>
        <div className="page-header-actions">
          <input type="file" accept=".csv" hidden ref={fileRef} onChange={handleImportCSV} />
          <button className="btn btn-outline btn-sm" onClick={() => fileRef.current?.click()}><Upload size={14} /> Importar CSV</button>
          <button className="btn btn-outline btn-sm" onClick={exportCSV}><Download size={14} /> Exportar</button>
          <button className="btn btn-primary" onClick={() => setShowForm(v => !v)}><Plus size={14} /> Novo produto</button>
        </div>
      </div>

      <div className="products-kpi-grid">
        <KpiCard icon={Package} label="Produtos Ativos" value={kpis.ativos} tone="brand" />
        <KpiCard icon={AlertTriangle} label="Produtos Criticos" value={kpis.criticos} tone="danger" />
        <KpiCard icon={Boxes} label="Sem Estoque" value={kpis.semEstoque} tone="warning" />
        <KpiCard icon={Tags} label="Categorias" value={kpis.categorias} tone="info" />
      </div>

      {showForm && (
        <div className="card" style={{ marginBottom: 18, animation: 'slideDown 0.18s ease-out' }}>
          <div className="card-header">
            <span className="card-title">Novo produto</span>
            <button className="icon-btn" onClick={() => setShowForm(false)}><X size={15} /></button>
          </div>
          <form onSubmit={handleSubmit} style={{ padding: '16px 20px 20px' }}>
            <div className="form-row">
              <div className="form-group input-float"><input className="input" value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} placeholder=" " required /><label>Nome *</label>
              </div>
              <div className="form-group input-float"><select className="select" value={form.categoria} onChange={e => setForm(f => ({ ...f, categoria: e.target.value }))}>
                  {['Pães', 'Salgados', 'Quitandas', 'Massas'].map(c => <option key={c}>{c}</option>)}
                </select><label>Categoria *</label></div>
            </div>
            <div className="form-row">
              <div className="form-group input-float"><input className="input" value={form.unidade_medida} onChange={e => setForm(f => ({ ...f, unidade_medida: e.target.value }))} placeholder=" " required /><label>Unidade *</label>
              </div>
              <div className="form-group input-float">
                <input className="input" type="number" min="0" value={form.estoque_minimo} onChange={e => setForm(f => ({ ...f, estoque_minimo: e.target.value }))} placeholder=" " />
                <label>Estoque minimo</label>
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button type="button" className="btn btn-outline" onClick={() => setShowForm(false)}>Cancelar</button>
              <button type="submit" className={`btn btn-primary ${submitting ? 'btn-loading' : ''}`} disabled={submitting}>
                {submitting ? 'Salvando...' : <><CheckCircle size={14} /> Salvar produto</>}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="table-wrap">
        <div className="table-toolbar">
          <div className="table-search">
            <Search size={14} />
            <input type="text" placeholder="Buscar produto, SKU, categoria ou tipo..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <div className="products-result-count">{filteredProdutos.length} resultados</div>
        </div>

        <div className="products-filter-strip">
          {[
            ['todos', 'Todos'],
            ['criticos', 'Criticos'],
            ['sem_estoque', 'Sem estoque'],
            ['abaixo_minimo', 'Abaixo do minimo'],
            ['inativos', 'Inativos'],
          ].map(([id, label]) => (
            <button key={id} type="button" className={`products-filter-chip${quickFilter === id ? ' active' : ''}`} onClick={() => setQuickFilter(id)}>
              {label} <span>{filterCounts[id]}</span>
            </button>
          ))}
        </div>

        <div className="products-table-scroll">
        <table className="products-table">
          <thead>
            <tr>
              <th><button className="sort-th" onClick={() => changeSort('codigo')}>SKU / ID {renderSortIcon('codigo')}</button></th>
              <th><button className="sort-th" onClick={() => changeSort('nome')}>Produto {renderSortIcon('nome')}</button></th>
              <th><button className="sort-th" onClick={() => changeSort('categoria')}>Categoria {renderSortIcon('categoria')}</button></th>
              <th>Tipo</th>
              <th>Unidade</th>
              <th style={{ textAlign: 'right' }}><button className="sort-th sort-th-right" onClick={() => changeSort('estoque')}>Estoque {renderSortIcon('estoque')}</button></th>
              <th style={{ textAlign: 'right' }}><button className="sort-th sort-th-right" onClick={() => changeSort('minimo')}>Minimo {renderSortIcon('minimo')}</button></th>
              <th><button className="sort-th" onClick={() => changeSort('cobertura')}>Cobertura {renderSortIcon('cobertura')}</button></th>
              <th>Saude</th>
              <th>ABC</th>
              <th>Ultima Mov.</th>
              <th>Status</th>
              <th style={{ textAlign: 'right' }}>Acoes</th>
            </tr>
          </thead>
          <tbody>
            {loading
              ? Array.from({ length: 6 }).map((_, i) => <SkeletonRow key={i} />)
              : filteredProdutos.length === 0
                ? (
                  <tr>
                    <td colSpan={13}>
                      <div className="empty-state">
                        <div className="empty-icon empty-icon-animated"><Package size={24} /></div>
                        <div className="empty-title">Nenhum produto encontrado</div>
                        <div className="empty-sub">{search ? 'Tente outro termo de busca.' : 'Cadastre o primeiro produto.'}</div>
                      </div>
                    </td>
                  </tr>
                )
                : filteredProdutos.map(p => {
                  const tipo = p.tipoInfo
                  const critical = isCritical(p)
                  const productId = getProductId(p)
                  return (
                    <tr key={productId} className={`${critical ? 'product-row-critical' : ''}${productId === newProductId ? ' row-new' : ''}`}>
                      <td style={{ fontFamily: '"IBM Plex Mono",monospace', fontSize: 12, color: 'var(--color-brand-700)', fontWeight: 500 }}>{p.codigo || productId}</td>
                      <td>
                        <button type="button" className="product-name-button" onClick={() => setSelectedProduct(p)}>{p.nome}</button>
                        {p.fabricante && <div style={{ fontSize: 11, color: 'var(--color-text-tertiary)' }}>{p.fabricante}</div>}
                        {critical && <div className="product-critical-note"><AlertTriangle size={12} /> Estoque abaixo do minimo</div>}
                      </td>
                      <td><span className="badge badge-neutral">{p.categoria || '-'}</span></td>
                      <td><span className={`badge ${tipo.color === 'info' ? 'badge-info' : 'badge-neutral'}`}>{tipo.label}</span></td>
                      <td style={{ color: 'var(--color-text-secondary)', fontSize: 12 }}>{p.unidade_medida || '-'}</td>
                      <td style={{ textAlign: 'right', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                        <span style={{ color: Number(p.estoque_atual) < Number(p.estoque_minimo) ? 'var(--color-danger-600)' : 'var(--color-text-primary)' }}>
                          {p.estoque_atual ?? '-'}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right', color: 'var(--color-text-tertiary)', fontVariantNumeric: 'tabular-nums' }}>{p.estoque_minimo ?? '-'}</td>
                      <td style={{ color: 'var(--color-text-secondary)', fontSize: 12 }}>{getCoverageLabel(p.coberturaDias)}</td>
                      <td><HealthScore score={p.healthScore} /></td>
                      <td><span className="badge badge-neutral">{p.curvaAbc || '-'}</span></td>
                      <td style={{ color: 'var(--color-text-secondary)', fontSize: 12 }}>{getLastMovementLabel(p.ultimaMovimentacao)}</td>
                      <td><StatusBadge status={p.status} estoque={Number(p.estoque_atual)} minimo={Number(p.estoque_minimo)} /></td>
                      <td style={{ textAlign: 'right' }}>
                        <div className="product-actions">
                          <button className="icon-btn" aria-label="Acoes" onClick={() => setOpenMenuId(openMenuId === productId ? null : productId)}><MoreVertical size={14} /></button>
                          {openMenuId === productId && (
                            <div className="product-actions-menu">
                              <button type="button" onClick={() => { setSelectedProduct(p); setOpenMenuId(null) }}><Eye size={13} /> Visualizar</button>
                              <a href={`/produtos?id=${productId}`}><Activity size={13} /> Editar</a>
                              <a href={`/lotes?produto=${productId}`}><Package size={13} /> Lotes</a>
                              <a href={`/historico?produto=${productId}`}><Clock size={13} /> Movimentacoes</a>
                              <a href={`/rastreabilidade?produto=${productId}`}><ShieldCheck size={13} /> Rastreabilidade</a>
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
          <span className="pagination-info">Exibindo {filteredProdutos.length} de {total} produtos</span>
        </div>
      </div>

      {selectedProduct && (
        <div className="product-drawer-layer" onMouseDown={e => { if (e.target === e.currentTarget) setSelectedProduct(null) }}>
          <aside className="product-drawer" role="dialog" aria-label="Detalhes do produto">
            <div className="product-drawer-header">
              <div>
                <div className="product-drawer-eyebrow">Produto</div>
                <h2>{selectedProduct.nome}</h2>
              </div>
              <button className="icon-btn" onClick={() => setSelectedProduct(null)} aria-label="Fechar"><X size={15} /></button>
            </div>
            <div className="product-drawer-body">
              {[
                ['SKU', selectedProduct.codigo || getProductId(selectedProduct)],
                ['Categoria', selectedProduct.categoria || '-'],
                ['Tipo', selectedProduct.tipoInfo?.label || getTipo(selectedProduct.categoria).label],
                ['Estoque Atual', selectedProduct.estoque_atual ?? '-'],
                ['Estoque Minimo', selectedProduct.estoque_minimo ?? '-'],
                ['Cobertura', getCoverageLabel(selectedProduct.coberturaDias)],
                ['Health Score', selectedProduct.healthScore],
                ['Ultima Movimentacao', getLastMovementLabel(selectedProduct.ultimaMovimentacao)],
                ['Lotes Ativos', '-'],
                ['Status', isActive(selectedProduct) ? 'Ativo' : 'Inativo'],
              ].map(([label, value]) => (
                <div key={label} className="product-drawer-row">
                  <span>{label}</span>
                  <strong>{value}</strong>
                </div>
              ))}
            </div>
            <div className="product-drawer-actions">
              <a className="btn btn-primary" href={`/produtos?id=${getProductId(selectedProduct)}`}>Editar</a>
              <a className="btn btn-outline" href={`/rastreabilidade?produto=${getProductId(selectedProduct)}`}>Rastreabilidade</a>
              <a className="btn btn-outline" href={`/historico?produto=${getProductId(selectedProduct)}`}>Movimentacoes</a>
            </div>
          </aside>
        </div>
      )}
      <style>{`
        @keyframes slideDown { from{opacity:0;transform:translateY(-6px)} to{opacity:1;transform:translateY(0)} }
        @keyframes drawerIn { from{opacity:0;transform:translateX(16px)} to{opacity:1;transform:translateX(0)} }
        .products-kpi-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 12px;
          margin-bottom: 16px;
        }
        .products-kpi-card {
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
        .products-kpi-icon {
          width: 30px;
          height: 30px;
          display: grid;
          place-items: center;
          background: var(--color-bg-subtle);
          border: 1px solid var(--color-border-muted);
          border-radius: var(--radius-sm);
          flex-shrink: 0;
        }
        .products-kpi-label {
          font-size: 10px;
          font-weight: 700;
          color: var(--color-text-tertiary);
          text-transform: uppercase;
          letter-spacing: 0.08em;
        }
        .products-kpi-value {
          margin-top: 2px;
          font-size: 26px;
          line-height: 1;
          font-weight: 800;
          color: var(--color-text-primary);
          font-variant-numeric: tabular-nums;
        }
        .products-result-count {
          margin-left: auto;
          font-size: 12px;
          color: var(--color-text-tertiary);
          white-space: nowrap;
        }
        .products-filter-strip {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 20px;
          border-bottom: 1px solid var(--color-border-default);
          flex-wrap: wrap;
          background: var(--color-bg-elevated);
        }
        .products-filter-chip {
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
        .products-filter-chip span {
          color: var(--color-text-tertiary);
          font-variant-numeric: tabular-nums;
        }
        .products-filter-chip:hover,
        .products-filter-chip.active {
          background: var(--color-bg-subtle);
          border-color: var(--color-border-strong);
          color: var(--color-text-primary);
        }
        .products-table-scroll {
          overflow: auto;
          max-height: calc(100vh - 330px);
        }
        .products-table thead th {
          position: sticky;
          top: 0;
          z-index: 2;
          background: var(--color-bg-elevated);
        }
        .products-table tbody tr {
          transition: background 100ms;
        }
        .products-table tbody tr:hover {
          background: var(--color-bg-subtle);
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
        .product-row-critical {
          box-shadow: inset 3px 0 0 var(--color-danger-600);
        }
        .product-name-button {
          display: inline;
          padding: 0;
          color: var(--color-text-primary);
          font-weight: 700;
          text-align: left;
          cursor: pointer;
        }
        .product-name-button:hover {
          color: var(--color-brand-700);
          text-decoration: underline;
        }
        .product-critical-note {
          display: flex;
          align-items: center;
          gap: 4px;
          margin-top: 4px;
          color: var(--color-danger-700);
          font-size: 11px;
          font-weight: 700;
        }
        .product-health {
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
        .product-health-success {
          color: var(--color-success-700);
          background: var(--color-success-50);
          border-color: var(--color-success-200);
        }
        .product-health-warning {
          color: var(--color-warning-700);
          background: var(--color-warning-50);
          border-color: var(--color-warning-200);
        }
        .product-health-danger {
          color: var(--color-danger-700);
          background: var(--color-danger-50);
          border-color: var(--color-danger-200);
        }
        .product-actions {
          position: relative;
          display: inline-flex;
          justify-content: flex-end;
        }
        .product-actions-menu {
          position: absolute;
          right: 0;
          top: 34px;
          z-index: 4;
          min-width: 178px;
          padding: 6px;
          background: var(--color-bg-default);
          border: 1px solid var(--color-border-default);
          border-radius: var(--radius-md);
          box-shadow: var(--shadow-md);
        }
        .product-actions-menu a,
        .product-actions-menu button {
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
        .product-actions-menu a:hover,
        .product-actions-menu button:hover {
          background: var(--color-bg-subtle);
          color: var(--color-text-primary);
        }
        .product-drawer-layer {
          position: fixed;
          inset: 0;
          z-index: 30;
          display: flex;
          justify-content: flex-end;
          background: transparent;
        }
        .product-drawer {
          width: min(460px, 100%);
          height: 100%;
          background: var(--color-bg-default);
          border-left: 1px solid var(--color-border-default);
          box-shadow: var(--shadow-lg);
          animation: drawerIn 160ms ease-out;
          display: flex;
          flex-direction: column;
        }
        .product-drawer-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 16px;
          padding: 20px;
          border-bottom: 1px solid var(--color-border-default);
          background: var(--color-bg-elevated);
        }
        .product-drawer-eyebrow {
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: var(--color-text-tertiary);
        }
        .product-drawer h2 {
          margin: 4px 0 0;
          font-size: 20px;
          color: var(--color-text-primary);
        }
        .product-drawer-body {
          padding: 16px 20px;
          overflow: auto;
        }
        .product-drawer-row {
          display: flex;
          justify-content: space-between;
          gap: 16px;
          padding: 11px 0;
          border-bottom: 1px solid var(--color-border-muted);
          font-size: 13px;
        }
        .product-drawer-row span {
          color: var(--color-text-tertiary);
        }
        .product-drawer-row strong {
          color: var(--color-text-primary);
          text-align: right;
          font-weight: 700;
        }
        .product-drawer-actions {
          display: flex;
          gap: 8px;
          padding: 14px 20px;
          border-top: 1px solid var(--color-border-default);
          flex-wrap: wrap;
        }
        @media (max-width: 1180px) {
          .products-kpi-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        }
        @media (max-width: 700px) {
          .products-kpi-grid { grid-template-columns: 1fr; }
          .products-table-scroll { max-height: none; }
          .product-drawer-actions .btn { width: 100%; justify-content: center; }
        }
      `}</style>
    </Layout>
  )
}



