import { useState, useEffect } from 'react'
import Layout from '../components/Layout.jsx'
import { useToast } from '../context/ToastContext.jsx'
import api from '../api/axios.js'
import { Download, Search, ArrowDownLeft, ArrowUpRight, Shuffle, Calendar, Activity } from 'lucide-react'

const TIPO_CFG = {
  entrada:      { icon: ArrowDownLeft, color: 'var(--color-success-600)', bg: 'var(--color-success-100)', label: 'Entrada' },
  saida:        { icon: ArrowUpRight,  color: 'var(--color-danger-600)',  bg: 'var(--color-danger-100)',  label: 'Saída'   },
  transferencia:{ icon: Shuffle,       color: 'var(--color-brand-600)',   bg: 'var(--color-brand-100)',   label: 'Transferência' },
  ajuste:       { icon: Activity,      color: 'var(--color-admin-600)',   bg: 'var(--color-admin-100)',   label: 'Ajuste'  },
}

function SkeletonRow() {
  return (
    <tr>
      {Array.from({ length: 9 }).map((_, i) => (
        <td key={i}><div style={{ height: 13, background: 'var(--color-bg-muted)', borderRadius: 4, animation: 'shimmer 1.2s ease-in-out infinite' }} /></td>
      ))}
    </tr>
  )
}

export default function Historico() {
  const toast = useToast()
  const [movs, setMovs] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [tipoFilter, setTipoFilter] = useState('todos')

  useEffect(() => {
    const t = setTimeout(() => load(), 300)
    return () => clearTimeout(t)
  }, [search])

  async function load() {
    setLoading(true)
    try {
      const { data } = await api.get('/movimentacoes', { params: { search, limit: 100 } })
      setMovs(data.data || data || [])
      setTotal(data.total || (data.data || data || []).length)
    } catch {
      toast.error('Erro ao carregar histórico.')
    } finally {
      setLoading(false)
    }
  }

  const filtered = tipoFilter === 'todos' ? movs : movs.filter(m => m.tipo === tipoFilter)

  function qtyLabel(m) {
    if (m.tipo === 'entrada') return `+${m.quantidade}`
    if (m.tipo === 'saida') return `-${m.quantidade}`
    return String(m.quantidade)
  }

  function locLabel(m) {
    if (m.tipo === 'transferencia') {
      const ori = m.localizacao_origem_nome || (m.origem_corredor ? `${m.origem_corredor}-N${m.origem_nivel}-P${m.origem_posicao}` : '?')
      const dst = m.localizacao_destino_nome || (m.destino_corredor ? `${m.destino_corredor}-N${m.destino_nivel}-P${m.destino_posicao}` : '?')
      return `${ori}→${dst}`
    }
    if (m.tipo === 'entrada' && m.localizacao_destino_nome) return m.localizacao_destino_nome
    if (m.tipo === 'saida' && m.localizacao_origem_nome) return m.localizacao_origem_nome
    if (m.localizacao_nome) return m.localizacao_nome
    return m.localizacao || '—'
  }

  return (
    <Layout breadcrumb={['Análise', 'Histórico']}>
      <div className="page-header">
        <div className="page-header-left">
          <h1>Histórico de Movimentações</h1>
          <div className="subtitle">
            <span className="live-dot" />
            <span><strong style={{ fontWeight: 600 }}>{total}</strong> movimentações</span>
            <span className="sep" />
            <span>Log imutável · retenção 7 anos</span>
          </div>
        </div>
        <div className="page-header-actions">
          <button className="btn btn-outline btn-sm"><Calendar size={14} /> Período</button>
          <button className="btn btn-outline btn-sm"><Download size={14} /> Exportar</button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {['todos', 'entrada', 'saida', 'transferencia', 'ajuste'].map(t => (
          <button
            key={t}
            onClick={() => setTipoFilter(t)}
            className={`btn btn-sm ${tipoFilter === t ? 'btn-primary' : 'btn-outline'}`}
          >
            {t === 'todos' ? 'Todos' : TIPO_CFG[t]?.label || t}
          </button>
        ))}
      </div>

      <div className="table-wrap">
        <div className="table-toolbar">
          <div className="table-search">
            <Search size={14} />
            <input type="text" placeholder="Buscar por lote, produto ou ID…" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </div>
        <table>
          <thead>
            <tr>
              <th>Tipo</th>
              <th>ID</th>
              <th>Data / Hora</th>
              <th>Lote</th>
              <th>Produto</th>
              <th style={{ textAlign: 'right' }}>Qtd</th>
              <th>Localização</th>
              <th>Operador</th>
            </tr>
          </thead>
          <tbody>
            {loading
              ? Array.from({ length: 6 }).map((_, i) => <SkeletonRow key={i} />)
              : filtered.length === 0
                ? (
                  <tr><td colSpan={8}>
                    <div className="empty-state">
                      <div className="empty-icon"><Activity size={24} /></div>
                      <div className="empty-title">Nenhuma movimentação encontrada</div>
                    </div>
                  </td></tr>
                )
                : filtered.map((m, i) => {
                  const cfg = TIPO_CFG[m.tipo] || { icon: Activity, color: 'var(--color-text-secondary)', bg: 'var(--color-bg-muted)', label: m.tipo }
                  const isEntrada = m.tipo === 'entrada'
                  const isSaida = m.tipo === 'saida'
                  return (
                    <tr key={m.id || i}>
                      <td>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 999, background: cfg.bg, color: cfg.color }}>
                          <cfg.icon size={11} />{cfg.label}
                        </span>
                      </td>
                      <td style={{ fontFamily: '"IBM Plex Mono",monospace', fontSize: 11, color: 'var(--color-brand-700)', fontWeight: 500 }}>{m.id}</td>
                      <td style={{ fontFamily: '"IBM Plex Mono",monospace', fontSize: 11 }}>
                        {m.data_movimentacao || m.criado_em ? new Date(m.data_movimentacao || m.criado_em).toLocaleString('pt-BR') : '—'}
                      </td>
                      <td style={{ fontFamily: '"IBM Plex Mono",monospace', fontSize: 11 }}>{m.numero_lote || m.codigo_lote || m.id_lote}</td>
                      <td style={{ fontWeight: 600 }}>{m.produto_nome || '—'}</td>
                      <td style={{ textAlign: 'right', fontWeight: 700, color: isEntrada ? 'var(--color-success-600)' : isSaida ? 'var(--color-danger-600)' : 'var(--color-text-primary)' }}>
                        {qtyLabel(m)}
                      </td>
                      <td style={{ fontFamily: '"IBM Plex Mono",monospace', fontSize: 11, color: 'var(--color-brand-700)' }}>{locLabel(m)}</td>
                      <td style={{ fontSize: 12 }}>{m.usuario_nome || '—'}</td>
                    </tr>
                  )
                })
            }
          </tbody>
        </table>
        <div className="pagination">
          <span className="pagination-info">Exibindo {filtered.length} de {total} movimentações</span>
        </div>
      </div>
      <style>{`@keyframes shimmer{0%,100%{opacity:1}50%{opacity:0.5}}`}</style>
    </Layout>
  )
}
