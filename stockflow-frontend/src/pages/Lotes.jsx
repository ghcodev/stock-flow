import { useState, useEffect } from 'react'
import Layout from '../components/Layout.jsx'
import { useToast } from '../context/ToastContext.jsx'
import api from '../api/axios.js'
import { Plus, Download, Search, Filter, Eye, Lock, ScanLine, RefreshCw, Layers } from 'lucide-react'

function StatusBadge({ status }) {
  const map = {
    'ativo':    { cls: 'badge-success', label: 'Ativo' },
    'vencendo': { cls: 'badge-warning', label: 'Vencendo' },
    'vencido':  { cls: 'badge-danger',  label: 'Vencido' },
    'bloqueado':{ cls: 'badge-neutral', label: 'Bloqueado' },
  }
  const key = status?.toLowerCase()
  const cfg = map[key] || { cls: 'badge-neutral', label: status || '—' }
  return <span className={`badge ${cfg.cls}`}>{cfg.label}</span>
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

function fmtLoc(l) {
  if (!l) return '—'
  if (l.corredor && l.nivel && l.posicao) return `${l.corredor}-N${l.nivel}-P${l.posicao}`
  return l.localizacao_nome || l.localizacao || '—'
}

function diasLabel(dias) {
  if (dias == null) return null
  if (dias < 0) return 'VENCIDO'
  if (dias < 30) return `vence em ${dias}d`
  return `${dias} dias`
}

export default function Lotes() {
  const toast = useToast()
  const [lotes, setLotes] = useState([])
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
      const { data } = await api.get('/lotes', { params: { search, limit: 50 } })
      setLotes(data.data || [])
      setTotal(data.total || 0)
    } catch {
      toast.error('Erro ao carregar lotes.')
    } finally {
      setLoading(false)
    }
  }

  const vencendo = lotes.filter(l => l.dias_para_vencer != null && l.dias_para_vencer >= 0 && l.dias_para_vencer <= 30).length
  const bloqueados = lotes.filter(l => (l.status_lote || l.status)?.toLowerCase() === 'bloqueado').length

  return (
    <Layout breadcrumb={['Operação', 'Lotes']}>
      <div className="page-header">
        <div className="page-header-left">
          <h1>Lotes</h1>
          <div className="subtitle">
            <strong style={{ color: 'var(--color-text-secondary)', fontWeight: 600 }}>{total}</strong> lotes
            {vencendo > 0 && <><span className="sep" /><strong style={{ color: 'var(--color-warning-700)', fontWeight: 600 }}>{vencendo}</strong> vencendo em 30 dias</>}
            {bloqueados > 0 && <><span className="sep" /><strong style={{ color: 'var(--color-danger-700)', fontWeight: 600 }}>{bloqueados}</strong> bloqueados</>}
          </div>
        </div>
        <div className="page-header-actions">
          <button className="btn btn-outline btn-sm"><Download size={14} /> Exportar</button>
          <button className="btn btn-outline btn-sm"><ScanLine size={14} /> Ler RFID</button>
          <button className="btn btn-outline btn-sm" onClick={load}><RefreshCw size={14} /> Atualizar</button>
          <button className="btn btn-primary"><Plus size={14} /> Registrar lote</button>
        </div>
      </div>

      <div className="table-wrap">
        <div className="table-toolbar">
          <div className="table-search">
            <Search size={14} />
            <input type="text" placeholder="Buscar por lote, RFID ou produto…" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <button className="btn btn-outline btn-sm"><Filter size={14} /> Status</button>
          <button className="btn btn-outline btn-sm"><Filter size={14} /> Validade</button>
        </div>

        <table>
          <thead>
            <tr>
              <th>Lote</th>
              <th>Produto</th>
              <th>Fabricação</th>
              <th>Validade</th>
              <th style={{ textAlign: 'right' }}>Qtd</th>
              <th>RFID</th>
              <th>Localização</th>
              <th style={{ textAlign: 'center' }}>Status</th>
              <th style={{ textAlign: 'right' }}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {loading
              ? Array.from({ length: 6 }).map((_, i) => <SkeletonRow key={i} />)
              : lotes.length === 0
                ? (
                  <tr>
                    <td colSpan={9}>
                      <div className="empty-state">
                        <div className="empty-icon"><Layers size={24} /></div>
                        <div className="empty-title">Nenhum lote encontrado</div>
                        <div className="empty-sub">{search ? 'Tente outro termo de busca.' : 'Nenhum lote cadastrado.'}</div>
                      </div>
                    </td>
                  </tr>
                )
                : lotes.map(l => {
                  const dias = l.dias_para_vencer
                  const loc = fmtLoc(l)
                  const codigo = l.numero_lote || l.codigo || l.id
                  const rfid = l.rfid || l.codigo_identificacao || l.identificacao?.codigo || l.identificacao_codigo
                  const status = l.status_lote || l.status
                  return (
                    <tr key={l.id}>
                      <td style={{ fontFamily: '"IBM Plex Mono",monospace', fontSize: 12, fontWeight: 600 }}>{codigo}</td>
                      <td>
                        <div style={{ fontWeight: 600 }}>{l.produto_nome || '—'}</div>
                        {l.produto_codigo && <div style={{ fontSize: 11, color: 'var(--color-text-tertiary)' }}>{l.produto_codigo}</div>}
                      </td>
                      <td style={{ fontFamily: '"IBM Plex Mono",monospace', fontSize: 12 }}>
                        {l.data_fabricacao ? new Date(l.data_fabricacao).toLocaleDateString('pt-BR') : '—'}
                      </td>
                      <td>
                        <span style={{ color: dias != null && dias < 30 ? 'var(--color-warning-700)' : dias != null && dias < 0 ? 'var(--color-danger-700)' : undefined, fontWeight: dias != null && dias < 30 ? 600 : undefined }}>
                          {l.data_validade ? new Date(l.data_validade).toLocaleDateString('pt-BR') : '—'}
                        </span>
                        {dias != null && (
                          <div style={{ fontSize: 10.5, color: dias < 30 ? 'var(--color-warning-700)' : 'var(--color-text-tertiary)', fontWeight: dias < 30 ? 500 : undefined, marginTop: 1 }}>
                            {diasLabel(dias)}
                          </div>
                        )}
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{l.quantidade ?? '—'}</td>
                      <td>
                        {rfid ? (
                          <span style={{ fontFamily: '"IBM Plex Mono",monospace', fontSize: 11, background: 'var(--color-bg-subtle)', padding: '2px 5px', borderRadius: 3, border: '1px solid var(--color-border-default)' }}>
                            {rfid}
                          </span>
                        ) : <span style={{ color: 'var(--color-text-tertiary)', fontSize: 12 }}>—</span>}
                      </td>
                      <td style={{ fontFamily: '"IBM Plex Mono",monospace', fontSize: 12, color: 'var(--color-brand-700)', fontWeight: 500 }}>{loc}</td>
                      <td style={{ textAlign: 'center' }}><StatusBadge status={status} /></td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 4 }}>
                          <button className="icon-btn" aria-label="Ver"><Eye size={14} /></button>
                          <button className="icon-btn" aria-label="Bloquear"><Lock size={14} /></button>
                          <button className="icon-btn" aria-label="Rastrear"><ScanLine size={14} /></button>
                        </div>
                      </td>
                    </tr>
                  )
                })
            }
          </tbody>
        </table>
        <div className="pagination">
          <span className="pagination-info">Exibindo {lotes.length} de {total} lotes</span>
        </div>
      </div>
      <style>{`@keyframes shimmer { 0%,100%{opacity:1} 50%{opacity:0.5} }`}</style>
    </Layout>
  )
}
