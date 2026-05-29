import { useRef, useState, useEffect } from 'react'
import Layout from '../components/Layout.jsx'
import { useToast } from '../context/ToastContext.jsx'
import api from '../api/axios.js'
import { Plus, Upload, Download, Search, Filter, Eye, Edit, Package, CheckCircle, X } from 'lucide-react'

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
      {Array.from({ length: 9 }).map((_, i) => (
        <td key={i}><div style={{ height: 14, background: 'var(--color-bg-muted)', borderRadius: 4, animation: 'shimmer 1.2s ease-in-out infinite' }} /></td>
      ))}
    </tr>
  )
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
  const [form, setForm] = useState({ nome: '', categoria: 'Pães', unidade_medida: 'unidade', estoque_minimo: '' })

  useEffect(() => {
    const t = setTimeout(() => load(), 300)
    return () => clearTimeout(t)
  }, [search])

  async function load() {
    setLoading(true)
    try {
      const { data } = await api.get('/produtos', { params: { busca: search, limit: 50 } })
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
      await api.post('/produtos', { ...form, estoque_minimo: Number(form.estoque_minimo || 0) })
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

  const abaixoMinimo = produtos.filter(p => Number(p.estoque_atual) < Number(p.estoque_minimo)).length

  return (
    <Layout breadcrumb={['Operação', 'Produtos']}>
      <div className="page-header">
        <div className="page-header-left">
          <h1>Produtos</h1>
          <div className="subtitle">
            <span><strong style={{ color: 'var(--color-text-secondary)', fontWeight: 600 }}>{total}</strong> cadastros</span>
            {abaixoMinimo > 0 && <><span className="sep" /><span><strong style={{ color: 'var(--color-danger-700)', fontWeight: 600 }}>{abaixoMinimo}</strong> abaixo do mínimo</span></>}
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

      {showForm && (
        <div className="card" style={{ marginBottom: 18, animation: 'slideDown 0.18s ease-out' }}>
          <div className="card-header">
            <span className="card-title">Novo produto</span>
            <button className="icon-btn" onClick={() => setShowForm(false)}><X size={15} /></button>
          </div>
          <form onSubmit={handleSubmit} style={{ padding: '16px 20px 20px' }}>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Nome *</label>
                <input className="input" value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} required />
              </div>
              <div className="form-group">
                <label className="form-label">Categoria *</label>
                <select className="select" value={form.categoria} onChange={e => setForm(f => ({ ...f, categoria: e.target.value }))}>
                  {['Pães', 'Salgados', 'Quitandas', 'Massas'].map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Unidade *</label>
                <input className="input" value={form.unidade_medida} onChange={e => setForm(f => ({ ...f, unidade_medida: e.target.value }))} required />
              </div>
              <div className="form-group">
                <label className="form-label">Estoque mínimo</label>
                <input className="input" type="number" min="0" value={form.estoque_minimo} onChange={e => setForm(f => ({ ...f, estoque_minimo: e.target.value }))} />
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button type="button" className="btn btn-outline" onClick={() => setShowForm(false)}>Cancelar</button>
              <button type="submit" className="btn btn-primary" disabled={submitting}>
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
            <input type="text" placeholder="Buscar por nome ou categoria..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <button className="btn btn-outline btn-sm"><Filter size={14} /> Filtros</button>
          <button className="btn btn-outline btn-sm" onClick={exportCSV}><Download size={14} /> Exportar</button>
        </div>

        <table>
          <thead>
            <tr>
              <th>SKU / ID</th>
              <th>Produto</th>
              <th>Categoria</th>
              <th>Tipo</th>
              <th>Unidade</th>
              <th style={{ textAlign: 'right' }}>Estoque</th>
              <th style={{ textAlign: 'right' }}>Mínimo</th>
              <th>Status</th>
              <th style={{ textAlign: 'right' }}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {loading
              ? Array.from({ length: 6 }).map((_, i) => <SkeletonRow key={i} />)
              : produtos.length === 0
                ? (
                  <tr>
                    <td colSpan={9}>
                      <div className="empty-state">
                        <div className="empty-icon"><Package size={24} /></div>
                        <div className="empty-title">Nenhum produto encontrado</div>
                        <div className="empty-sub">{search ? 'Tente outro termo de busca.' : 'Cadastre o primeiro produto.'}</div>
                      </div>
                    </td>
                  </tr>
                )
                : produtos.map(p => {
                  const tipo = getTipo(p.categoria)
                  return (
                    <tr key={p.id}>
                      <td style={{ fontFamily: '"IBM Plex Mono",monospace', fontSize: 12, color: 'var(--color-brand-700)', fontWeight: 500 }}>{p.codigo || p.id}</td>
                      <td>
                        <div style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>{p.nome}</div>
                        {p.fabricante && <div style={{ fontSize: 11, color: 'var(--color-text-tertiary)' }}>{p.fabricante}</div>}
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
                      <td><StatusBadge status={p.status} estoque={Number(p.estoque_atual)} minimo={Number(p.estoque_minimo)} /></td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 4 }}>
                          <button className="icon-btn" aria-label="Ver"><Eye size={14} /></button>
                          <button className="icon-btn" aria-label="Editar"><Edit size={14} /></button>
                        </div>
                      </td>
                    </tr>
                  )
                })
            }
          </tbody>
        </table>

        <div className="pagination">
          <span className="pagination-info">Exibindo {produtos.length} de {total} produtos</span>
        </div>
      </div>
      <style>{`@keyframes shimmer { 0%,100%{opacity:1} 50%{opacity:0.5} } @keyframes slideDown { from{opacity:0;transform:translateY(-6px)} to{opacity:1;transform:translateY(0)} }`}</style>
    </Layout>
  )
}
