import { useState, useEffect } from 'react'
import Layout from '../components/Layout.jsx'
import { useToast } from '../context/ToastContext.jsx'
import api from '../api/axios.js'
import {
  Package, Layers, AlertTriangle,
  TrendingUp, TrendingDown, RefreshCw, Download, Plus,
  ArrowDownLeft, ArrowUpRight, ArrowRight, Activity,
} from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'

function SkeletonCard() {
  return (
    <div className="card" style={{ padding: '18px 20px' }}>
      <div style={{ height: 11, width: 120, background: 'var(--color-bg-muted)', borderRadius: 4, marginBottom: 16, animation: 'shimmer 1.2s ease-in-out infinite' }} />
      <div style={{ height: 28, width: 80, background: 'var(--color-bg-muted)', borderRadius: 4, animation: 'shimmer 1.2s ease-in-out infinite' }} />
    </div>
  )
}

function fmtTipo(tipo) {
  const m = { entrada: 'Entrada', saida: 'Saída', transferencia: 'Transferência', ajuste: 'Ajuste' }
  return m[tipo] || tipo
}

export default function Dashboard() {
  const toast = useToast()
  const [kpis, setKpis] = useState(null)
  const [movData, setMovData] = useState([])
  const [alertas, setAlertas] = useState([])
  const [recentes, setRecentes] = useState([])
  const [loading, setLoading] = useState(true)

  async function load() {
    setLoading(true)
    try {
      const [kpisRes, movRes, alertasRes, recentesRes] = await Promise.all([
        api.get('/dashboard/kpis'),
        api.get('/dashboard/movimentacoes'),
        api.get('/dashboard/alertas'),
        api.get('/movimentacoes?limit=5'),
      ])
      setKpis(kpisRes.data)
      const rawMov = movRes.data || []
      setMovData(rawMov.map(d => ({
        ...d,
        dia: new Date(d.dia || d.data || d.date)
          .toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
      })))
      setAlertas(alertasRes.data?.alertas || [])
      setRecentes(recentesRes.data?.data || [])
    } catch {
      toast.error('Erro ao carregar dados do dashboard.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const KPI_ITEMS = kpis ? [
    { label: 'Movimentações hoje', value: kpis.movimentacoes_hoje ?? '—', icon: Activity, color: 'var(--color-brand-600)' },
    { label: 'Total produtos',     value: kpis.total_produtos ?? '—',      icon: Package,  color: 'var(--color-success-600)' },
    { label: 'Lotes vencendo',     value: kpis.lotes_vencendo ?? '—',      icon: Layers,   color: 'var(--color-warning-600)', warn: true },
    { label: 'Lotes bloqueados',   value: kpis.lotes_bloqueados ?? '—',    icon: AlertTriangle, color: 'var(--color-danger-600)', danger: true },
  ] : []

  return (
    <Layout breadcrumb={['Dashboard']}>
      <div className="page-header">
        <div className="page-header-left">
          <h1>Dashboard</h1>
          <div className="subtitle">
            <span className="live-dot" />
            <span>Arte Trigo · Unidade Central</span>
          </div>
        </div>
        <div className="page-header-actions">
          <button className="btn btn-outline btn-sm"><Download size={14} /> Exportar</button>
          <button className="btn btn-outline btn-sm" onClick={load}><RefreshCw size={14} /> Atualizar</button>
        </div>
      </div>

      {/* KPI GRID */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16, marginBottom: 24 }}>
        {loading
          ? Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)
          : KPI_ITEMS.map(k => (
            <div key={k.label} className="card" style={{ padding: '18px 20px', position: 'relative' }}>
              <div style={{ position: 'absolute', top: 14, right: 14, color: 'var(--color-bg-muted)' }}>
                <k.icon size={22} />
              </div>
              <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-text-tertiary)', marginBottom: 8 }}>
                {k.label}
              </div>
              <div style={{ fontSize: 34, fontWeight: 800, letterSpacing: '-0.04em', color: k.danger ? 'var(--color-danger-600)' : k.warn ? 'var(--color-warning-600)' : 'var(--color-text-primary)', fontVariantNumeric: 'tabular-nums', lineHeight: 1.1 }}>
                {k.value}
              </div>
            </div>
          ))
        }
      </div>

      {/* CHARTS ROW */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16, marginBottom: 24 }}>
        <div className="card">
          <div className="card-header">
            <span className="card-title">Movimentações por dia — últimos 30 dias</span>
          </div>
          <div style={{ padding: '8px 20px 16px' }}>
            {loading ? (
              <div style={{ height: 180, background: 'var(--color-bg-subtle)', borderRadius: 8, animation: 'shimmer 1.2s ease-in-out infinite' }} />
            ) : (
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={movData} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-default)" vertical={false} />
                  <XAxis dataKey="dia" tick={{ fontSize: 10, fill: 'var(--color-text-tertiary)' }} axisLine={false} tickLine={false}
                    interval="preserveStartEnd" />
                  <YAxis tick={{ fontSize: 11, fill: 'var(--color-text-tertiary)' }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid var(--color-border-default)', boxShadow: 'var(--shadow-md)' }} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="total" name="Total" fill="#2E75B6" radius={[3,3,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="card">
          <div className="card-header"><span className="card-title">Alertas ativos</span>
            {alertas.length > 0 && <span className="badge badge-danger">{alertas.filter(a => a.nivel === 'critical').length} críticos</span>}
          </div>
          <div>
            {loading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <div key={i} style={{ padding: '11px 20px', borderBottom: '1px solid var(--color-border-muted)', display: 'flex', gap: 10, alignItems: 'center' }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--color-bg-muted)', flexShrink: 0 }} />
                  <div style={{ height: 12, flex: 1, background: 'var(--color-bg-muted)', borderRadius: 4, animation: 'shimmer 1.2s ease-in-out infinite' }} />
                </div>
              ))
            ) : alertas.length === 0 ? (
              <div style={{ padding: '32px 20px', textAlign: 'center', color: 'var(--color-text-tertiary)', fontSize: 13 }}>Nenhum alerta ativo</div>
            ) : alertas.slice(0, 5).map((a, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 20px', borderBottom: i < Math.min(alertas.length, 5) - 1 ? '1px solid var(--color-border-muted)' : 'none' }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', marginTop: 4, flexShrink: 0, background: a.nivel === 'critical' ? 'var(--color-danger-500)' : a.nivel === 'warning' ? 'var(--color-warning-500)' : 'var(--color-info-600)' }} />
                <div style={{ flex: 1, fontSize: 12, color: 'var(--color-text-secondary)', lineHeight: 1.45 }}>
                  {a.produto_nome || a.codigo_lote || a.mensagem || 'Alerta de estoque'}
                  {a.dias_para_vencer != null && <span style={{ color: 'var(--color-warning-600)', fontWeight: 600 }}> · {a.dias_para_vencer}d</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* RECENT MOVEMENTS */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">Movimentações recentes</span>
          <a href="/historico" style={{ fontSize: 12, color: 'var(--color-brand-600)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>Ver todas <ArrowRight size={12} /></a>
        </div>
        <div>
          {loading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 20px', borderBottom: '1px solid var(--color-border-muted)' }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--color-bg-muted)', flexShrink: 0, animation: 'shimmer 1.2s ease-in-out infinite' }} />
                <div style={{ flex: 1 }}>
                  <div style={{ height: 13, width: '60%', background: 'var(--color-bg-muted)', borderRadius: 4, marginBottom: 6, animation: 'shimmer 1.2s ease-in-out infinite' }} />
                  <div style={{ height: 11, width: '40%', background: 'var(--color-bg-muted)', borderRadius: 4, animation: 'shimmer 1.2s ease-in-out infinite' }} />
                </div>
              </div>
            ))
          ) : recentes.length === 0 ? (
            <div style={{ padding: '32px 20px', textAlign: 'center', color: 'var(--color-text-tertiary)', fontSize: 13 }}>Nenhuma movimentação registrada</div>
          ) : recentes.map((r, i) => {
            const isEntrada = r.tipo === 'entrada'
            const isSaida = r.tipo === 'saida'
            return (
              <div key={r.id || i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 20px', borderBottom: i < recentes.length - 1 ? '1px solid var(--color-border-muted)' : 'none' }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, display: 'grid', placeItems: 'center', flexShrink: 0, background: isEntrada ? 'var(--color-success-100)' : isSaida ? 'var(--color-danger-100)' : 'var(--color-brand-100)', color: isEntrada ? 'var(--color-success-600)' : isSaida ? 'var(--color-danger-600)' : 'var(--color-brand-600)' }}>
                  {isEntrada ? <ArrowDownLeft size={15} /> : isSaida ? <ArrowUpRight size={15} /> : <ArrowRight size={15} />}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.produto_nome || r.codigo_lote || '—'}</div>
                  <div style={{ fontSize: 11, color: 'var(--color-text-tertiary)', fontFamily: '"IBM Plex Mono",monospace', marginTop: 1 }}>{r.codigo_lote} · {fmtTipo(r.tipo)}</div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: isEntrada ? 'var(--color-success-600)' : isSaida ? 'var(--color-danger-600)' : 'var(--color-text-secondary)' }}>
                    {isEntrada ? '+' : isSaida ? '-' : ''}{Number(r.quantidade)}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--color-text-tertiary)' }}>{r.usuario_nome || '—'}</div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <style>{`@keyframes shimmer { 0%,100%{opacity:1} 50%{opacity:0.5} }`}</style>
    </Layout>
  )
}
