import { useEffect, useMemo, useState } from 'react'
import { CheckCircle, Pencil, Search, X } from 'lucide-react'
import api from '../api/axios.js'
import { useToast } from '../context/ToastContext.jsx'
import { TIPOS_ARMAZENAGEM, codigoLocalizacao, rotuloArmazenagem } from '../constants/armazenagem.js'

const FORM_INICIAL = { corredor: '', nivel: '', posicao: '', tipo_zona: 'seco', capacidade: '', distancia_expedicao: '' }

export default function LocalizacoesModal({ onClose, onSaved }) {
  const toast = useToast()
  const [locs, setLocs] = useState([])
  const [loading, setLoading] = useState(true)
  const [busca, setBusca] = useState('')
  const [zona, setZona] = useState('todas')
  const [form, setForm] = useState(FORM_INICIAL)
  const [editingId, setEditingId] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  async function load() {
    setLoading(true)
    try {
      const { data } = await api.get('/localizacoes')
      setLocs(data?.data || data || [])
    } catch {
      toast.error('Erro ao carregar localizações.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  useEffect(() => {
    function onKeyDown(e) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  const contagemZona = useMemo(() => locs.reduce((total, l) => ({ ...total, [l.tipo_zona]: (total[l.tipo_zona] || 0) + 1 }), { todas: locs.length }), [locs])

  const filtradas = useMemo(() => {
    const termo = busca.trim().toLowerCase()
    return locs.filter(l => (zona === 'todas' || l.tipo_zona === zona)
      && (!termo || `${codigoLocalizacao(l)} ${rotuloArmazenagem(l.tipo_zona)}`.toLowerCase().includes(termo)))
  }, [locs, busca, zona])

  function campo(nome) {
    return e => setForm(f => ({ ...f, [nome]: e.target.value }))
  }

  function editar(l) {
    setEditingId(l.id)
    setForm({
      corredor: l.corredor || '',
      nivel: String(l.nivel ?? ''),
      posicao: String(l.posicao ?? ''),
      tipo_zona: l.tipo_zona || 'seco',
      capacidade: l.capacidade == null ? '' : String(Number(l.capacidade)),
      distancia_expedicao: String(l.distancia_expedicao ?? 0),
    })
  }

  function limpar() {
    setEditingId(null)
    setForm(FORM_INICIAL)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setSubmitting(true)
    const payload = {
      corredor: form.corredor.trim(),
      nivel: Number(form.nivel),
      posicao: Number(form.posicao),
      tipo_zona: form.tipo_zona,
      capacidade: form.capacidade === '' ? null : Number(form.capacidade),
      distancia_expedicao: Number(form.distancia_expedicao || 0),
    }
    try {
      if (editingId) await api.put(`/localizacoes/${editingId}`, payload)
      else await api.post('/localizacoes', payload)
      toast.success(editingId ? 'Localização atualizada com sucesso!' : 'Localização cadastrada com sucesso!')
      limpar()
      load()
      onSaved?.()
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erro ao salvar localização.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal localizacoes-modal" role="dialog" aria-label="Localizações">
        <div className="modal-header">
          <h3 className="modal-title">Localizações</h3>
          <button className="icon-btn" aria-label="Fechar" onClick={onClose}><X size={16} /></button>
        </div>
        <div className="modal-body">
          <form onSubmit={handleSubmit} className="localizacoes-form">
            <div className="localizacoes-form-title">{editingId ? 'Editar localização' : 'Nova localização'}</div>
            <div className="localizacoes-form-grid">
              <div className="form-group">
                <label className="form-label" htmlFor="loc-corredor">Corredor *</label>
                <input id="loc-corredor" className="input" maxLength={10} value={form.corredor} onChange={campo('corredor')} required />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="loc-nivel">Nível *</label>
                <input id="loc-nivel" className="input" type="number" min="1" step="1" value={form.nivel} onChange={campo('nivel')} required />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="loc-posicao">Posição *</label>
                <input id="loc-posicao" className="input" type="number" min="1" step="1" value={form.posicao} onChange={campo('posicao')} required />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="loc-zona">Tipo de zona *</label>
                <select id="loc-zona" className="select" value={form.tipo_zona} onChange={campo('tipo_zona')}>
                  {TIPOS_ARMAZENAGEM.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="loc-capacidade">Capacidade</label>
                <input id="loc-capacidade" className="input" type="number" min="0.001" step="0.001" placeholder="Sem limite" value={form.capacidade} onChange={campo('capacidade')} />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="loc-distancia">Distância até a expedição</label>
                <input id="loc-distancia" className="input" type="number" min="0" step="1" placeholder="0" value={form.distancia_expedicao} onChange={campo('distancia_expedicao')} />
              </div>
            </div>
            <div className="localizacoes-form-actions">
              {editingId && <button type="button" className="btn btn-outline btn-sm" onClick={limpar}>Cancelar edição</button>}
              <button type="submit" className={`btn btn-primary btn-sm ${submitting ? 'btn-loading' : ''}`} disabled={submitting}>
                {submitting ? 'Salvando...' : <><CheckCircle size={14} /> {editingId ? 'Salvar alterações' : 'Cadastrar localização'}</>}
              </button>
            </div>
          </form>

          <div className="table-wrap">
            <div className="table-toolbar">
              <div className="table-search">
                <Search />
                <input type="text" placeholder="Buscar por posição ou zona..." value={busca} onChange={e => setBusca(e.target.value)} />
              </div>
              <div className="localizacoes-filtros" aria-label="Filtrar por zona">
                {[{ value: 'todas', label: 'Todas' }, ...TIPOS_ARMAZENAGEM].map(t => (
                  <button key={t.value} type="button" aria-pressed={zona === t.value} className={`localizacoes-filtro${zona === t.value ? ' active' : ''}`} onClick={() => setZona(t.value)}>
                    {t.label} <span>{contagemZona[t.value] || 0}</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="localizacoes-table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Posição</th>
                    <th>Zona</th>
                    <th style={{ textAlign: 'right' }}>Capacidade</th>
                    <th style={{ textAlign: 'right' }}>Distância</th>
                    <th aria-label="Ações" />
                  </tr>
                </thead>
                <tbody>
                  {loading
                    ? <tr><td colSpan={5}><div className="skeleton" style={{ height: 14 }} /></td></tr>
                    : filtradas.length === 0
                      ? <tr><td colSpan={5} className="localizacoes-vazio">Nenhuma localização encontrada.</td></tr>
                      : filtradas.map(l => (
                        <tr key={l.id} className={editingId === l.id ? 'localizacoes-row-ativa' : ''}>
                          <td className="localizacoes-codigo">{codigoLocalizacao(l)}</td>
                          <td><span className="badge badge-neutral">{rotuloArmazenagem(l.tipo_zona)}</span></td>
                          <td style={{ textAlign: 'right' }}>{l.capacidade == null ? 'Sem limite' : Number(l.capacidade).toLocaleString('pt-BR')}</td>
                          <td style={{ textAlign: 'right' }}>{l.distancia_expedicao ?? 0}</td>
                          <td style={{ textAlign: 'right' }}>
                            <button type="button" className="btn btn-outline btn-sm" onClick={() => editar(l)}><Pencil size={13} /> Editar</button>
                          </td>
                        </tr>
                      ))}
                </tbody>
              </table>
            </div>
            <div className="pagination">
              <span className="pagination-info">Exibindo {filtradas.length} de {locs.length} localizações</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
