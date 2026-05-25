import { useState, useEffect } from 'react'
import Layout from '../components/Layout.jsx'
import { useToast } from '../context/ToastContext.jsx'
import api from '../api/axios.js'
import { Plus, Download, CheckCircle, X, Clipboard } from 'lucide-react'

const StatusBadge = ({ s }) => {
  const map = { 'concluido': 'badge-success', 'em andamento': 'badge-warning', 'pendente': 'badge-neutral' }
  const key = (s || '').toLowerCase()
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

export default function Inventario() {
  const toast = useToast()
  const [inventarios, setInventarios] = useState([])
  const [loading, setLoading] = useState(true)
  const [showNew, setShowNew] = useState(false)
  const [form, setForm] = useState({ corredor: '', operador: '', observacao: '' })
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    try {
      const { data } = await api.get('/inventarios')
      setInventarios(data.data || data || [])
    } catch {
      toast.error('Erro ao carregar inventários.')
    } finally {
      setLoading(false)
    }
  }

  const concluidos = inventarios.filter(i => (i.status || '').toLowerCase() === 'concluido' || i.status === 'Concluído')
  const mediaAcur = concluidos.length > 0
    ? concluidos.reduce((s, i) => s + (i.acuracidade || 100), 0) / concluidos.length
    : 100

  async function handleCreate(e) {
    e.preventDefault()
    if (!form.corredor) return
    setSubmitting(true)
    try {
      await api.post('/inventarios', { corredor: form.corredor, observacao: form.observacao })
      toast.success('Inventário iniciado com sucesso!')
      setShowNew(false)
      setForm({ corredor: '', operador: '', observacao: '' })
      load()
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erro ao iniciar inventário.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Layout breadcrumb={['Movimentações', 'Inventário Rotativo']}>
      <div className="page-header">
        <div className="page-header-left">
          <h1>Inventário Rotativo</h1>
          <div className="subtitle">
            <span><strong style={{ color: 'var(--color-success-700)', fontWeight: 600 }}>{concluidos.length}</strong> concluídos</span>
            <span className="sep" />
            <span>Acuracidade média: <strong style={{ color: 'var(--color-success-700)', fontWeight: 700 }}>{mediaAcur.toFixed(1)}%</strong></span>
          </div>
        </div>
        <div className="page-header-actions">
          <button className="btn btn-outline btn-sm"><Download size={14} /> Exportar</button>
          <button className="btn btn-primary" onClick={() => setShowNew(true)}><Plus size={14} /> Iniciar inventário</button>
        </div>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Corredor</th>
              <th>Início</th>
              <th>Término</th>
              <th style={{ textAlign: 'right' }}>Total pos.</th>
              <th style={{ textAlign: 'right' }}>Conferidas</th>
              <th style={{ textAlign: 'right' }}>Divergências</th>
              <th style={{ textAlign: 'right' }}>Acuracidade</th>
              <th style={{ textAlign: 'center' }}>Status</th>
              <th>Operador</th>
            </tr>
          </thead>
          <tbody>
            {loading
              ? Array.from({ length: 4 }).map((_, i) => <SkeletonRow key={i} />)
              : inventarios.length === 0
                ? (
                  <tr><td colSpan={10}>
                    <div className="empty-state">
                      <div className="empty-icon"><Clipboard size={24} /></div>
                      <div className="empty-title">Nenhum inventário registrado</div>
                      <div className="empty-sub">Inicie o primeiro inventário rotativo.</div>
                    </div>
                  </td></tr>
                )
                : inventarios.map(inv => {
                  const em = (inv.status || '').toLowerCase().includes('andamento')
                  return (
                    <tr key={inv.id}>
                      <td style={{ fontFamily: '"IBM Plex Mono",monospace', fontSize: 11, fontWeight: 600, color: 'var(--color-brand-700)' }}>{inv.id}</td>
                      <td><span style={{ fontWeight: 700 }}>Corredor {inv.corredor}</span></td>
                      <td style={{ fontFamily: '"IBM Plex Mono",monospace', fontSize: 11 }}>
                        {inv.inicio || inv.criado_em ? new Date(inv.inicio || inv.criado_em).toLocaleString('pt-BR') : '—'}
                      </td>
                      <td style={{ fontFamily: '"IBM Plex Mono",monospace', fontSize: 11 }}>
                        {inv.fim ? new Date(inv.fim).toLocaleString('pt-BR') : <span style={{ color: 'var(--color-text-tertiary)' }}>Em andamento…</span>}
                      </td>
                      <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{inv.total || '—'}</td>
                      <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                        {em
                          ? <span style={{ color: 'var(--color-warning-700)' }}>{inv.conferidos || 0} / {inv.total || '?'}</span>
                          : inv.conferidos ?? '—'
                        }
                      </td>
                      <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                        <span style={{ color: (inv.divergencias || 0) > 0 ? 'var(--color-danger-600)' : 'var(--color-success-600)', fontWeight: 700 }}>
                          {inv.divergencias ?? 0}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 700, color: inv.acuracidade == null ? 'var(--color-text-tertiary)' : inv.acuracidade >= 99.5 ? 'var(--color-success-600)' : 'var(--color-warning-700)' }}>
                        {inv.acuracidade != null ? `${inv.acuracidade}%` : '—'}
                      </td>
                      <td style={{ textAlign: 'center' }}><StatusBadge s={inv.status} /></td>
                      <td style={{ fontSize: 12 }}>{inv.usuario_nome || inv.op || '—'}</td>
                    </tr>
                  )
                })
            }
          </tbody>
        </table>
      </div>

      {showNew && (
        <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && setShowNew(false)}>
          <div className="modal">
            <div className="modal-header">
              <h3 className="modal-title">Iniciar Inventário Rotativo</h3>
              <button className="icon-btn" onClick={() => setShowNew(false)}><X size={16} /></button>
            </div>
            <form onSubmit={handleCreate}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Corredor *</label>
                  <select className="select" value={form.corredor} onChange={e => setForm(f => ({ ...f, corredor: e.target.value }))} required>
                    <option value="">Selecionar corredor…</option>
                    {['A', 'B', 'C', 'D'].map(c => <option key={c} value={c}>Corredor {c}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Observação</label>
                  <textarea className="textarea" placeholder="Opcional…" value={form.observacao} onChange={e => setForm(f => ({ ...f, observacao: e.target.value }))} />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={() => setShowNew(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting
                    ? <><span style={{ width: 13, height: 13, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.65s linear infinite', display: 'inline-block' }} /> Iniciando…</>
                    : <><CheckCircle size={14} /> Iniciar inventário</>
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
