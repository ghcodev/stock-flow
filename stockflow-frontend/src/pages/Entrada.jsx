import { useState, useEffect, useRef } from 'react'
import Layout from '../components/Layout.jsx'
import { useToast } from '../context/ToastContext.jsx'
import api from '../api/axios.js'
import { Plus, Download, Search, ArrowDownLeft, ScanLine, CheckCircle, Clock, X } from 'lucide-react'

const StatusBadge = ({ s }) => {
  const map = { 'concluida': 'badge-success', 'conferida': 'badge-info', 'pendente': 'badge-warning' }
  const key = s?.toLowerCase().replace(/[^a-z]/g, '')
  return <span className={`badge ${map[key] || 'badge-neutral'}`}>{s}</span>
}

function SkeletonRow() {
  return (
    <tr>
      {Array.from({ length: 10 }).map((_, i) => (
        <td key={i}><div style={{ height: 13, background: 'var(--color-bg-muted)', borderRadius: 4, animation: 'shimmer 1.2s ease-in-out infinite' }} /></td>
      ))}
    </tr>
  )
}

export default function Entrada() {
  const toast = useToast()
  const [movs, setMovs] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [lotes, setLotes] = useState([])
  const [form, setForm] = useState({ id_lote: '', quantidade: '' })
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => load(), 300)
    return () => clearTimeout(t)
  }, [search])

  async function load() {
    setLoading(true)
    try {
      const { data } = await api.get('/movimentacoes', { params: { tipo: 'entrada', search, limit: 50 } })
      const items = (data.data || data || []).filter(m => m.tipo === 'entrada')
      setMovs(items)
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
    try {
      const { data } = await api.get('/lotes', { params: { limit: 100 } })
      setLotes(data.data || [])
    } catch {}
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.id_lote || !form.quantidade) return
    setSubmitting(true)
    try {
      await api.post('/movimentacoes/entrada', {
        id_lote: Number(form.id_lote),
        quantidade: Number(form.quantidade),
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
    return m.localizacao || '—'
  }

  return (
    <Layout breadcrumb={['Movimentações', 'Entrada']}>
      <div className="page-header">
        <div className="page-header-left">
          <h1>Entrada de Lotes</h1>
          <div className="subtitle">
            <span><strong style={{ fontWeight: 600 }}>{total}</strong> entradas</span>
          </div>
        </div>
        <div className="page-header-actions">
          <button className="btn btn-outline btn-sm"><ScanLine size={14} /> Ler RFID</button>
          <button className="btn btn-outline btn-sm"><Download size={14} /> Exportar</button>
          <button className="btn btn-primary" onClick={openForm}><Plus size={14} /> Nova entrada</button>
        </div>
      </div>

      <div className="table-wrap">
        <div className="table-toolbar">
          <div className="table-search">
            <Search size={14} />
            <input type="text" placeholder="Buscar por lote ou produto…" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </div>
        <table>
          <thead>
            <tr>
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
              ? Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)
              : movs.length === 0
                ? (
                  <tr><td colSpan={7}>
                    <div className="empty-state">
                      <div className="empty-icon"><ArrowDownLeft size={24} /></div>
                      <div className="empty-title">Nenhuma entrada encontrada</div>
                      <div className="empty-sub">Registre a primeira entrada de lote.</div>
                    </div>
                  </td></tr>
                )
                : movs.map((m, i) => (
                  <tr key={m.id || i}>
                    <td style={{ fontFamily: '"IBM Plex Mono",monospace', fontSize: 11, color: 'var(--color-brand-700)', fontWeight: 600 }}>{m.id}</td>
                    <td style={{ fontFamily: '"IBM Plex Mono",monospace', fontSize: 11 }}>
                      {m.data_movimentacao || m.criado_em ? new Date(m.data_movimentacao || m.criado_em).toLocaleString('pt-BR') : '—'}
                    </td>
                    <td style={{ fontFamily: '"IBM Plex Mono",monospace', fontSize: 11 }}>{m.numero_lote || m.codigo_lote || m.id_lote}</td>
                    <td style={{ fontWeight: 600 }}>{m.produto_nome || '—'}</td>
                    <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--color-success-600)' }}>+{Number(m.quantidade)}</td>
                    <td style={{ fontFamily: '"IBM Plex Mono",monospace', fontSize: 11, color: 'var(--color-brand-700)' }}>{fmtLoc(m)}</td>
                    <td style={{ fontSize: 12 }}>{m.usuario_nome || '—'}</td>
                  </tr>
                ))
            }
          </tbody>
        </table>
        <div className="pagination">
          <span className="pagination-info">Exibindo {movs.length} de {total} entradas</span>
        </div>
      </div>

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
                    ? <><span style={{ width: 13, height: 13, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.65s linear infinite', display: 'inline-block' }} /> Registrando…</>
                    : <><CheckCircle size={14} /> Registrar entrada</>
                  }
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      <style>{`@keyframes shimmer{0%,100%{opacity:1}50%{opacity:0.5}} @keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </Layout>
  )
}
