import { useRef, useState, useEffect } from 'react'
import Layout from '../components/Layout.jsx'
import { useToast } from '../context/ToastContext.jsx'
import api from '../api/axios.js'
import {
  Package, Layers, AlertTriangle,
  RefreshCw, Download,
  ArrowDownLeft, ArrowUpRight, ArrowRight, Activity,
} from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Sector,
} from 'recharts'

const MOV_COLORS = {
  entradas: '#16a34a',
  saidas: '#dc2626',
  transferencias: '#2E75B6',
  ajustes: '#d97706',
}

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

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  const values = Object.fromEntries(payload.map(p => [p.dataKey, Number(p.value || 0)]))
  const total = (values.entradas || 0) + (values.saidas || 0) + (values.transferencias || 0)
  const title = payload[0]?.payload?.dataLonga || label

  return (
    <div style={{ background: '#fff', boxShadow: 'var(--shadow-lg)', border: '1px solid var(--color-border-muted)', borderRadius: 8, padding: '8px 12px', fontSize: 12 }}>
      <div style={{ fontWeight: 700, color: 'var(--color-text-primary)', marginBottom: 6 }}>{title}</div>
      {[
        ['entradas', 'Entradas'],
        ['saidas', 'Saídas'],
        ['transferencias', 'Transf.'],
      ].map(([key, name]) => (
        <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--color-text-secondary)', lineHeight: 1.7 }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: MOV_COLORS[key] }} />
          <span>{name}: {values[key] || 0} un</span>
        </div>
      ))}
      <div style={{ borderTop: '1px solid var(--color-border-muted)', marginTop: 6, paddingTop: 6, fontWeight: 800 }}>Total: {total} un</div>
    </div>
  )
}

function PieTooltip({ active, payload, total }) {
  if (!active || !payload?.length) return null
  const item = payload[0]
  const value = Number(item.value || 0)
  const pct = total ? Math.round((value / total) * 100) : 0
  return (
    <div style={{ background: '#fff', boxShadow: 'var(--shadow-lg)', border: '1px solid var(--color-border-muted)', borderRadius: 8, padding: '8px 12px', fontSize: 12 }}>
      <strong>{item.name}</strong>: {value} un - {pct}%
    </div>
  )
}

function renderActiveShape(props) {
  return <Sector {...props} outerRadius={90} />
}

export default function Dashboard() {
  const toast = useToast()
  const [kpis, setKpis] = useState(null)
  const [movData, setMovData] = useState([])
  const [recentes, setRecentes] = useState([])
  const [loading, setLoading] = useState(true)
  const [activePie, setActivePie] = useState(null)
  const scrollRef = useRef(null)
  const [isDragging, setIsDragging] = useState(false)
  const [startX, setStartX] = useState(0)
  const [scrollLeft, setScrollLeft] = useState(0)

  async function load() {
    setLoading(true)
    try {
      const [kpisRes, movRes, recentesRes] = await Promise.all([
        api.get('/dashboard/kpis'),
        api.get('/dashboard/movimentacoes'),
        api.get('/movimentacoes?limit=5'),
      ])
      setKpis(kpisRes.data)
      setMovData((movRes.data || []).map(d => ({
        dataLonga: new Date(d.dia).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' }),
        dia: new Date(d.dia).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
        entradas: Number(d.entradas || 0),
        saidas: Number(d.saidas || 0),
        transferencias: Number(d.transferencias || 0),
        ajustes: Number(d.ajustes || 0),
      })))
      setRecentes(recentesRes.data?.data || [])
    } catch {
      toast.error('Erro ao carregar dados do dashboard.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  function onDragStart(e) {
    if (!scrollRef.current) return
    setIsDragging(true)
    setStartX(e.clientX)
    setScrollLeft(scrollRef.current.scrollLeft)
  }

  function onDragMove(e) {
    if (!isDragging || !scrollRef.current) return
    scrollRef.current.scrollLeft = scrollLeft - (e.clientX - startX)
  }

  const KPI_ITEMS = kpis ? [
    { label: 'Movimentações hoje', value: kpis.movimentacoes_hoje ?? '-', icon: Activity },
    { label: 'Total produtos', value: kpis.total_produtos ?? '-', icon: Package },
    { label: 'Lotes vencendo', value: kpis.lotes_vencendo ?? '-', icon: Layers, warn: true },
    { label: 'Lotes bloqueados', value: kpis.lotes_bloqueados ?? '-', icon: AlertTriangle, danger: true },
  ] : []

  const pieData = [
    { name: 'Entradas', value: movData.reduce((acc, d) => acc + d.entradas, 0), color: MOV_COLORS.entradas },
    { name: 'Saídas', value: movData.reduce((acc, d) => acc + d.saidas, 0), color: MOV_COLORS.saidas },
    { name: 'Transferências', value: movData.reduce((acc, d) => acc + d.transferencias, 0), color: MOV_COLORS.transferencias },
    { name: 'Ajustes', value: movData.reduce((acc, d) => acc + d.ajustes, 0), color: MOV_COLORS.ajustes },
  ].filter(d => d.value > 0)
  const pieTotal = pieData.reduce((acc, d) => acc + d.value, 0)

  return (
    <Layout breadcrumb={['Dashboard']}>
      <div className="page-header">
        <div className="page-header-left">
          <h1>Dashboard</h1>
          <div className="subtitle">
            <span className="live-dot" />
            <span>StockFlow - Unidade Central</span>
          </div>
        </div>
        <div className="page-header-actions">
          <button className="btn btn-outline btn-sm"><Download size={14} /> Exportar</button>
          <button className="btn btn-outline btn-sm" onClick={load}><RefreshCw size={14} /> Atualizar</button>
        </div>
      </div>

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
              <div style={{ fontSize: 34, fontWeight: 800, color: k.danger ? 'var(--color-danger-600)' : k.warn ? 'var(--color-warning-600)' : 'var(--color-text-primary)', fontVariantNumeric: 'tabular-nums', lineHeight: 1.1 }}>
                {k.value}
              </div>
            </div>
          ))
        }
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 3fr) minmax(280px, 2fr)', gap: 16, marginBottom: 24 }}>
        <div className="card">
          <div className="card-header">
            <span className="card-title">Movimentações por Dia — Últimos 30 dias</span>
          </div>
          <div style={{ padding: '8px 20px 16px' }}>
            {loading ? (
              <div style={{ height: 180, background: 'var(--color-bg-subtle)', borderRadius: 8, animation: 'shimmer 1.2s ease-in-out infinite' }} />
            ) : (
              <>
                <div
                  ref={scrollRef}
                  onMouseDown={onDragStart}
                  onMouseMove={onDragMove}
                  onMouseUp={() => setIsDragging(false)}
                  onMouseLeave={() => setIsDragging(false)}
                  style={{ overflowX: 'auto', cursor: isDragging ? 'grabbing' : 'grab', userSelect: isDragging ? 'none' : 'auto', paddingBottom: 6 }}
                >
                  <div style={{ width: movData.length > 15 ? Math.max(720, movData.length * 48) : '100%', height: 188 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={movData} margin={{ top: 4, right: 8, bottom: 0, left: 0 }} barGap={2}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="dia" tick={{ fontSize: 10, fill: 'var(--color-text-tertiary)' }} axisLine={false} tickLine={false} />
                        <YAxis width={32} tick={{ fontSize: 10, fill: 'var(--color-text-tertiary)' }} axisLine={false} tickLine={false} />
                        <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(46,117,182,0.05)' }} />
                        <Bar dataKey="entradas" name="Entradas" fill={MOV_COLORS.entradas} radius={[3,3,0,0]} barSize={6} animationDuration={800} animationEasing="ease-out" />
                        <Bar dataKey="saidas" name="Saídas" fill={MOV_COLORS.saidas} radius={[3,3,0,0]} barSize={6} animationDuration={800} animationEasing="ease-out" />
                        <Bar dataKey="transferencias" name="Transferências" fill={MOV_COLORS.transferencias} radius={[3,3,0,0]} barSize={6} animationDuration={800} animationEasing="ease-out" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'center', gap: 18, fontSize: 12, color: 'var(--color-text-secondary)', marginTop: 8 }}>
                  {[
                    ['Entradas', MOV_COLORS.entradas],
                    ['Saídas', MOV_COLORS.saidas],
                    ['Transferências', MOV_COLORS.transferencias],
                  ].map(([label, color]) => (
                    <span key={label} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: color }} />{label}
                    </span>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <span className="card-title">Distribuição por Tipo</span>
          </div>
          <div style={{ padding: '8px 20px 18px' }}>
            {loading ? (
              <div style={{ height: 240, background: 'var(--color-bg-subtle)', borderRadius: 8, animation: 'shimmer 1.2s ease-in-out infinite' }} />
            ) : pieTotal === 0 ? (
              <div style={{ height: 240, display: 'grid', placeItems: 'center', color: 'var(--color-text-tertiary)', fontSize: 13 }}>Sem movimentações no período</div>
            ) : (
              <>
                <div style={{ position: 'relative', height: 218 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={55}
                        outerRadius={85}
                        activeIndex={activePie}
                        activeShape={renderActiveShape}
                        dataKey="value"
                        onMouseEnter={(_, index) => setActivePie(index)}
                        onMouseLeave={() => setActivePie(null)}
                        animationDuration={800}
                        animationEasing="ease-out"
                      >
                        {pieData.map((entry) => <Cell key={entry.name} fill={entry.color} />)}
                      </Pie>
                      <Tooltip content={<PieTooltip total={pieTotal} />} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', pointerEvents: 'none' }}>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: 24, fontWeight: 800, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>{pieTotal}</div>
                      <div style={{ fontSize: 11, color: 'var(--color-text-tertiary)', marginTop: 4 }}>movimentações</div>
                    </div>
                  </div>
                </div>
                <div style={{ display: 'grid', gap: 8, marginTop: 2 }}>
                  {pieData.map(item => {
                    const pct = pieTotal ? Math.round((item.value / pieTotal) * 100) : 0
                    return (
                      <div key={item.name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, fontSize: 12 }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, color: 'var(--color-text-secondary)' }}>
                          <span style={{ width: 8, height: 8, borderRadius: '50%', background: item.color }} />{item.name}
                        </span>
                        <span style={{ fontWeight: 700, color: 'var(--color-text-primary)', fontVariantNumeric: 'tabular-nums' }}>{pct}% <span style={{ fontWeight: 500, color: 'var(--color-text-tertiary)' }}>({item.value} un)</span></span>
                      </div>
                    )
                  })}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

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
            <div style={{ padding: '32px 20px', textAlign: 'center', color: 'var(--color-text-tertiary)', fontSize: 13 }}>Nenhuma movimentacao registrada</div>
          ) : recentes.map((r, i) => {
            const isEntrada = r.tipo === 'entrada'
            const isSaida = r.tipo === 'saida'
            return (
              <div key={r.id || i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 20px', borderBottom: i < recentes.length - 1 ? '1px solid var(--color-border-muted)' : 'none' }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, display: 'grid', placeItems: 'center', flexShrink: 0, background: isEntrada ? 'var(--color-success-100)' : isSaida ? 'var(--color-danger-100)' : 'var(--color-brand-100)', color: isEntrada ? 'var(--color-success-600)' : isSaida ? 'var(--color-danger-600)' : 'var(--color-brand-600)' }}>
                  {isEntrada ? <ArrowDownLeft size={15} /> : isSaida ? <ArrowUpRight size={15} /> : <ArrowRight size={15} />}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.produto_nome || r.codigo_lote || '-'}</div>
                  <div style={{ fontSize: 11, color: 'var(--color-text-tertiary)', fontFamily: '"IBM Plex Mono",monospace', marginTop: 1 }}>{r.codigo_lote} - {fmtTipo(r.tipo)}</div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: isEntrada ? 'var(--color-success-600)' : isSaida ? 'var(--color-danger-600)' : 'var(--color-text-secondary)' }}>
                    {isEntrada ? '+' : isSaida ? '-' : ''}{Number(r.quantidade)}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--color-text-tertiary)' }}>{r.usuario_nome || '-'}</div>
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
