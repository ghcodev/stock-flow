import { useState, useEffect } from 'react'
import Layout from '../components/Layout.jsx'
import { useToast } from '../context/ToastContext.jsx'
import api from '../api/axios.js'
import { Plus, Upload, Download, Search, Filter, Eye, Edit, Package } from 'lucide-react'

function StatusBadge({ status, estoque, minimo }) {
  if (!status) {
    if (estoque === 0) return <span className="badge badge-neutral">Inativo</span>
    if (estoque < minimo) return <span className="badge badge-danger">Crítico</span>
    return <span className="badge badge-success">Ativo</span>
  }
  const map = { 'ativo': 'badge-success', 'inativo': 'badge-neutral', 'critico': 'badge-danger' }
  return <span className={`badge ${map[status.toLowerCase()] || 'badge-neutral'}`}>{status}</span>
}

function SkeletonRow() {
  return (
    <tr>
      {Array.from({ length: 8 }).map((_, i) => (
        <td key={i}><div style={{ height: 14, background: 'var(--color-bg-muted)', borderRadius: 4, animation: 'shimmer 1.2s ease-in-out infinite' }} /></td>
      ))}
    </tr>
  )
}

export default function Produtos() {
  const toast = useToast()
  const [produtos, setProdutos] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    const t = setTimeout(() => load(), 300)
    return () => clearTimeout(t)
  }, [search])

  async function load() {
    setLoading(true)
    try {
      const { data } = await api.get('/produtos', { params: { search, limit: 50 } })
      setProdutos(data.data || [])
      setTotal(data.total || 0)
    } catch {
      toast.error('Erro ao carregar produtos.')
    } finally {
      setLoading(false)
    }
  }

  const abaixoMinimo = produtos.filter(p => p.estoque_atual < p.estoque_minimo).length

  return (
    <Layout breadcrumb={['Operação', 'Produtos']}>
      <div className="page-header">
        <div className="page-header-left">
          <h1>Produtos</h1>
          <div className="subtitle">
            <span><strong style={{ color: 'var(--color-text-secondary)', fontWeight: 600 }}>{total}</strong> cadastros</span>
            {abaixoMinimo > 0 && <>
              <span className="sep" />
              <span><strong style={{ color: 'var(--color-danger-700)', fontWeight: 600 }}>{abaixoMinimo}</strong> abaixo do mínimo</span>
            </>}
          </div>
        </div>
        <div className="page-header-actions">
          <button className="btn btn-outline btn-sm"><Upload size={14} /> Importar CSV</button>
          <button className="btn btn-outline btn-sm"><Download size={14} /> Exportar</button>
          <button className="btn btn-primary"><Plus size={14} /> Novo produto</button>
        </div>
      </div>

      <div className="table-wrap">
        <div className="table-toolbar">
          <div className="table-search">
            <Search size={14} />
            <input
              type="text"
              placeholder="Buscar por nome, SKU ou categoria…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <button className="btn btn-outline btn-sm"><Filter size={14} /> Filtros</button>
          <button className="btn btn-outline btn-sm"><Download size={14} /> Exportar</button>
        </div>

        <table>
          <thead>
            <tr>
              <th>SKU / ID</th>
              <th>Produto</th>
              <th>Tipo</th>
              <th>Categoria</th>
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
                    <td colSpan={8}>
                      <div className="empty-state">
                        <div className="empty-icon"><Package size={24} /></div>
                        <div className="empty-title">Nenhum produto encontrado</div>
                        <div className="empty-sub">{search ? 'Tente outro termo de busca.' : 'Cadastre o primeiro produto.'}</div>
                      </div>
                    </td>
                  </tr>
                )
                : produtos.map(p => (
                  <tr key={p.id}>
                    <td style={{ fontFamily: '"IBM Plex Mono",monospace', fontSize: 12, color: 'var(--color-brand-700)', fontWeight: 500 }}>{p.codigo || p.id}</td>
                    <td>
                      <div style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>{p.nome}</div>
                      {p.fabricante && <div style={{ fontSize: 11, color: 'var(--color-text-tertiary)' }}>{p.fabricante}</div>}
                    </td>
                    <td style={{ color: 'var(--color-text-secondary)', fontSize: 12 }}>{p.tipo || '—'}</td>
                    <td><span className="badge badge-neutral">{p.categoria || '—'}</span></td>
                    <td style={{ textAlign: 'right', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                      <span style={{ color: p.estoque_atual < p.estoque_minimo ? 'var(--color-danger-600)' : 'var(--color-text-primary)' }}>
                        {p.estoque_atual ?? '—'}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right', color: 'var(--color-text-tertiary)', fontVariantNumeric: 'tabular-nums' }}>{p.estoque_minimo ?? '—'}</td>
                    <td><StatusBadge status={p.status} estoque={p.estoque_atual} minimo={p.estoque_minimo} /></td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 4 }}>
                        <button className="icon-btn" aria-label="Ver"><Eye size={14} /></button>
                        <button className="icon-btn" aria-label="Editar"><Edit size={14} /></button>
                      </div>
                    </td>
                  </tr>
                ))
            }
          </tbody>
        </table>

        <div className="pagination">
          <span className="pagination-info">Exibindo {produtos.length} de {total} produtos</span>
        </div>
      </div>
      <style>{`@keyframes shimmer { 0%,100%{opacity:1} 50%{opacity:0.5} }`}</style>
    </Layout>
  )
}
