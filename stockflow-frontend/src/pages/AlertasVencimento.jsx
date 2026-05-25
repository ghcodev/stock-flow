import { useState, useEffect } from 'react'
import Layout from '../components/Layout.jsx'
import { useToast } from '../context/ToastContext.jsx'
import api from '../api/axios.js'
import { Clock, CheckCircle, Lock, Download, Filter, AlertTriangle } from 'lucide-react'

const NIVEL_CFG = {
  critical: { label: 'Crítico (≤15d)',   badgeCls: 'badge-danger',  border: 'var(--color-danger-200)',  bg: 'var(--color-danger-50)',  color: 'var(--color-danger-700)' },
  warning:  { label: 'Alerta (16–30d)',  badgeCls: 'badge-warning', border: 'var(--color-warning-200)', bg: 'var(--color-warning-50)', color: 'var(--color-warning-700)' },
  info:     { label: 'Atenção (31–60d)', badgeCls: 'badge-info',    border: undefined,                  bg: undefined,                color: 'var(--color-info-700)' },
}

function nivel(dias) {
  if (dias <= 15) return 'critical'
  if (dias <= 30) return 'warning'
  return 'info'
}

function SkeletonRow() {
  return (
    <tr>
      {Array.from({ length: 8 }).map((_, i) => (
        <td key={i}><div style={{ height: 13, background: 'var(--color-bg-muted)', borderRadius: 4, animation: 'shimmer 1.2s ease-in-out infinite' }} /></td>
      ))}
    </tr>
  )
}

export default function AlertasVencimento() {
  const toast = useToast()
  const [alertas, setAlertas] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    try {
      const { data } = await api.get('/lotes/vencendo')
      const items = data.data || data || []
      setAlertas(items)
    } catch {
      toast.error('Erro ao carregar alertas de vencimento.')
    } finally {
      setLoading(false)
    }
  }

  const enriched = alertas.map(a => ({ ...a, _nivel: nivel(a.dias_para_vencer ?? 999) }))
  const critical = enriched.filter(a => a._nivel === 'critical')
  const warning  = enriched.filter(a => a._nivel === 'warning')
  const info     = enriched.filter(a => a._nivel === 'info')

  return (
    <Layout breadcrumb={['Análise', 'Alertas de Vencimento']}>
      <div className="page-header">
        <div className="page-header-left">
          <h1>Alertas de Vencimento</h1>
          <div className="subtitle">
            <span><strong style={{ color: 'var(--color-danger-700)', fontWeight: 600 }}>{critical.length}</strong> críticos (≤15 dias)</span>
            <span className="sep" />
            <span><strong style={{ color: 'var(--color-warning-700)', fontWeight: 600 }}>{warning.length}</strong> alertas (16–30 dias)</span>
            <span className="sep" />
            <span><strong style={{ fontWeight: 600 }}>{info.length}</strong> atenção (31–60 dias)</span>
          </div>
        </div>
        <div className="page-header-actions">
          <button className="btn btn-outline btn-sm"><Filter size={14} /> Filtrar</button>
          <button className="btn btn-outline btn-sm"><Download size={14} /> Exportar</button>
        </div>
      </div>

      <div className="summary-grid" style={{ gridTemplateColumns: 'repeat(4,1fr)', marginBottom: 24 }}>
        {[
          { l: 'Total de alertas',  v: enriched.length.toString(), sub: 'Próximos 60 dias' },
          { l: 'Críticos (≤15d)',   v: critical.length.toString(), sub: 'Ação imediata',        bg: 'var(--color-danger-50)', border: 'var(--color-danger-200)', color: 'var(--color-danger-700)' },
          { l: 'Alerta (16–30d)',   v: warning.length.toString(),  sub: 'Planejar descarte/uso', bg: 'var(--color-warning-50)', border: 'var(--color-warning-200)', color: 'var(--color-warning-700)' },
          { l: 'Atenção (31–60d)', v: info.length.toString(),     sub: 'Monitorar' },
        ].map(c => (
          <div key={c.l} className="summary-card" style={{ background: c.bg, borderColor: c.border }}>
            <div className="label">{c.l}</div>
            <div className="value" style={{ color: c.color }}>{c.v}</div>
            <div style={{ fontSize: 12, color: c.color || 'var(--color-text-tertiary)' }}>{c.sub}</div>
          </div>
        ))}
      </div>

      {loading ? (
        <div className="table-wrap">
          <table>
            <tbody>{Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)}</tbody>
          </table>
        </div>
      ) : enriched.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <div className="empty-icon"><Clock size={24} /></div>
            <div className="empty-title">Nenhum alerta de vencimento</div>
            <div className="empty-sub">Todos os lotes estão dentro do prazo de validade.</div>
          </div>
        </div>
      ) : [
        { nivel: 'critical', items: critical },
        { nivel: 'warning',  items: warning  },
        { nivel: 'info',     items: info     },
      ].map(grupo => grupo.items.length > 0 && (
        <div key={grupo.nivel} style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <span className={`badge ${NIVEL_CFG[grupo.nivel].badgeCls}`}>{NIVEL_CFG[grupo.nivel].label}</span>
            <span style={{ fontSize: 12, color: 'var(--color-text-tertiary)' }}>{grupo.items.length} lotes</span>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Lote</th>
                  <th>Produto</th>
                  <th style={{ textAlign: 'center' }}>Dias restantes</th>
                  <th>Validade</th>
                  <th style={{ textAlign: 'right' }}>Qtd. atual</th>
                  <th>Localização</th>
                  <th style={{ textAlign: 'right' }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {grupo.items.map(a => {
                  const cfg = NIVEL_CFG[a._nivel]
                  const loc = a.corredor ? `${a.corredor}-N${a.nivel_loc || a.nivel}-P${a.posicao}` : '—'
                  return (
                    <tr key={a.id} style={{ background: cfg.bg }}>
                      <td style={{ fontFamily: '"IBM Plex Mono",monospace', fontSize: 11, fontWeight: 600, color: 'var(--color-brand-700)' }}>{a.codigo || a.id}</td>
                      <td style={{ fontWeight: 600 }}>{a.produto_nome || '—'}</td>
                      <td style={{ textAlign: 'center' }}>
                        <span style={{ fontWeight: 800, fontSize: 16, color: cfg.color, fontVariantNumeric: 'tabular-nums' }}>{a.dias_para_vencer}</span>
                        <span style={{ fontSize: 11, color: cfg.color, marginLeft: 4 }}>dias</span>
                      </td>
                      <td style={{ fontFamily: '"IBM Plex Mono",monospace', fontSize: 12, color: cfg.color, fontWeight: 600 }}>
                        {a.data_validade ? new Date(a.data_validade).toLocaleDateString('pt-BR') : '—'}
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{a.quantidade ?? '—'}</td>
                      <td style={{ fontFamily: '"IBM Plex Mono",monospace', fontSize: 11, color: 'var(--color-brand-700)', fontWeight: 500 }}>{loc}</td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 4 }}>
                          <button className="btn btn-sm btn-outline"><CheckCircle size={12} /> Usar</button>
                          <button className="btn btn-sm btn-outline" style={{ color: 'var(--color-danger-600)' }}><Lock size={12} /> Bloquear</button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      ))}
      <style>{`@keyframes shimmer{0%,100%{opacity:1}50%{opacity:0.5}}`}</style>
    </Layout>
  )
}
