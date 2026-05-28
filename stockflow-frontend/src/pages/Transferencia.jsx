import { useState, useEffect } from 'react'
import Layout from '../components/Layout.jsx'
import { useToast } from '../context/ToastContext.jsx'
import api from '../api/axios.js'
import { Plus, Download, Search, Shuffle, CheckCircle, X, ArrowRight, AlertTriangle } from 'lucide-react'

const StatusBadge = ({ s }) => {
  const map = { 'concluida': 'badge-success', 'pendente': 'badge-warning' }
  const key = s?.toLowerCase().replace(/[^a-z]/g, '')
  return <span className={`badge ${map[key] || 'badge-neutral'}`}>{s}</span>
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

export default function Transferencia() {
  const toast = useToast()
  const [movs, setMovs] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [lotes, setLotes] = useState([])
  const [locs, setLocs] = useState([])
  const [form, setForm] = useState({ id_lote: '', id_localizacao_destino: '', quantidade: '', motivo_movimentacao: '' })
  const [submitting, setSubmitting] = useState(false)
  const [formErr, setFormErr] = useState('')

  useEffect(() => {
    const t = setTimeout(() => load(), 300)
    return () => clearTimeout(t)
  }, [search])

  async function load() {
    setLoading(true)
    try {
      const { data } = await api.get('/movimentacoes', { params: { tipo: 'transferencia', search, limit: 50 } })
      const items = data.data || data || []
      setMovs(items)
      setTotal(data.total || items.length)
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
      const msg = err.response?.data?.error || 'Erro ao registrar transferência.'
      setFormErr(msg)
    } finally {
      setSubmitting(false)
    }
  }

  function fmtLoc(m) {
    const ori = m.origem_corredor ? `${m.origem_corredor}-N${m.origem_nivel}-P${m.origem_posicao}` : (m.localizacao_origem || '—')
    const dst = m.destino_corredor ? `${m.destino_corredor}-N${m.destino_nivel}-P${m.destino_posicao}` : (m.localizacao_destino || '—')
    return { ori, dst }
  }

  return (
    <Layout breadcrumb={['Movimentações', 'Transferência']}>
      <div className="page-header">
        <div className="page-header-left">
          <h1>Transferências</h1>
          <div className="subtitle">
            <span><strong style={{ fontWeight: 600 }}>{total}</strong> transferências</span>
          </div>
        </div>
        <div className="page-header-actions">
          <button className="btn btn-outline btn-sm"><Download size={14} /> Exportar</button>
          <button className="btn btn-primary" onClick={openForm}><Plus size={14} /> Nova transferência</button>
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
              <th>Origem</th>
              <th></th>
              <th>Destino</th>
              <th>Operador</th>
            </tr>
          </thead>
          <tbody>
            {loading
              ? Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)
              : movs.length === 0
                ? (
                  <tr><td colSpan={9}>
                    <div className="empty-state">
                      <div className="empty-icon"><Shuffle size={24} /></div>
                      <div className="empty-title">Nenhuma transferência encontrada</div>
                      <div className="empty-sub">Registre a primeira transferência de lote.</div>
                    </div>
                  </td></tr>
                )
                : movs.map((m, i) => {
                  const { ori, dst } = fmtLoc(m)
                  return (
                    <tr key={m.id || i}>
                      <td style={{ fontFamily: '"IBM Plex Mono",monospace', fontSize: 11, color: 'var(--color-brand-700)', fontWeight: 600 }}>{m.id}</td>
                      <td style={{ fontFamily: '"IBM Plex Mono",monospace', fontSize: 11 }}>
                        {m.criado_em ? new Date(m.criado_em).toLocaleString('pt-BR') : '—'}
                      </td>
                      <td style={{ fontFamily: '"IBM Plex Mono",monospace', fontSize: 11 }}>{m.codigo_lote || m.id_lote}</td>
                      <td style={{ fontWeight: 600 }}>{m.produto_nome || '—'}</td>
                      <td style={{ textAlign: 'right', fontWeight: 700 }}>{Number(m.quantidade)}</td>
                      <td style={{ fontFamily: '"IBM Plex Mono",monospace', fontSize: 11, color: 'var(--color-text-secondary)' }}>{ori}</td>
                      <td><ArrowRight size={14} style={{ color: 'var(--color-text-tertiary)' }} /></td>
                      <td style={{ fontFamily: '"IBM Plex Mono",monospace', fontSize: 11, color: 'var(--color-brand-700)', fontWeight: 500 }}>{dst}</td>
                      <td style={{ fontSize: 12 }}>{m.usuario_nome || '—'}</td>
                    </tr>
                  )
                })
            }
          </tbody>
        </table>
        <div className="pagination">
          <span className="pagination-info">Exibindo {movs.length} de {total} transferências</span>
        </div>
      </div>

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
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', background: 'var(--color-danger-50)', border: '1px solid var(--color-danger-200)', borderRadius: 8, marginBottom: 16, fontSize: 13, color: 'var(--color-danger-700)' }}>
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
                  <textarea className="textarea" placeholder="Descreva o motivo da transferência…" style={{ minHeight: 70 }}
                    value={form.motivo_movimentacao} onChange={e => setForm(f => ({ ...f, motivo_movimentacao: e.target.value }))} />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={() => setShowForm(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary" disabled={submitting || !motivoValido}>
                  {submitting
                    ? <><span style={{ width: 13, height: 13, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.65s linear infinite', display: 'inline-block' }} /> Registrando…</>
                    : <><CheckCircle size={14} /> Confirmar transferência</>
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
