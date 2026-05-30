import { useRef, useState, useEffect } from 'react'
import Layout from '../components/Layout.jsx'
import { useToast } from '../context/ToastContext.jsx'
import api from '../api/axios.js'
import {
  Package, Layers, AlertTriangle, RefreshCw, Download, ArrowDownLeft,
  ArrowUpRight, ArrowRight, Activity, Clock, TrendingDown, Lock, ShieldCheck,
  Circle,
} from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Sector, LineChart, Line,
} from 'recharts'

const MOV_COLORS = {
  entradas: '#16a34a',
  saidas: '#dc2626',
  transferencias: '#2E75B6',
  ajustes: '#d97706',
}

const CORREDORES = {
  'CF-01': 'Camara Fria 01',
  'CF-02': 'Camara Fria 02',
  'CF-03': 'Camara Fria 03',
  'CF-04': 'Camara Fria 04',
  'ES-01': 'Estoque Seco 01',
  'ES-02': 'Estoque Seco 02',
}

function SkeletonCard({ height = 110 }) {
  return (
    <div className="card" style={{ padding: '18px 20px', minHeight: height }}>
      <div style={{ height: 11, width: 120, background: 'var(--color-bg-muted)', borderRadius: 4, marginBottom: 16, animation: 'shimmer 1.2s ease-in-out infinite' }} />
      <div style={{ height: 28, width: 80, background: 'var(--color-bg-muted)', borderRadius: 4, animation: 'shimmer 1.2s ease-in-out infinite' }} />
    </div>
  )
}

function fmtTipo(tipo) {
  const m = { entrada: 'Entrada', saida: 'Saida', transferencia: 'Transferencia', ajuste: 'Ajuste', inventario: 'Inventario' }
  return m[tipo] || tipo || '-'
}

function fmtDateLong(value) {
  if (!value) return '-'
  return new Date(value).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' })
}

function fmtTime(value) {
  if (!value) return '-'
  return new Date(value).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

function trendPercent(today, yesterday) {
  const t = Number(today || 0)
  const y = Number(yesterday || 0)
  if (y === 0) return t > 0 ? 100 : 0
  return Math.round(((t - y) / y) * 100)
}

function pctColor(pct) {
  if (pct > 90) return 'var(--color-danger-600)'
  if (pct >= 70) return 'var(--color-warning-600)'
  return 'var(--color-success-600)'
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
        ['saidas', 'Saidas'],
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

function Sparkline({ data }) {
  const rows = (data || []).map(item => ({ ...item, total: Number(item.total || 0) }))
  if (!rows.length) return null
  return (
    <div style={{ width: 96, height: 32 }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={rows}>
          <Line type="monotone" dataKey="total" stroke="var(--color-brand-600)" strokeWidth={2} dot={false} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

function KpiCard({ item }) {
  const Icon = item.icon
  return (
    <div className="card" style={{ padding: '18px 20px', position: 'relative', minHeight: 132 }}>
      <div style={{ position: 'absolute', top: 14, right: 14, color: 'var(--color-bg-muted)' }}>
        <Icon size={22} />
      </div>
      <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', color: 'var(--color-text-tertiary)', marginBottom: 8 }}>
        {item.label}
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12 }}>
        <div>
          <div style={{ fontSize: 34, fontWeight: 800, color: item.color || 'var(--color-text-primary)', fontVariantNumeric: 'tabular-nums', lineHeight: 1.1 }}>
            {item.value}
          </div>
          <div style={{ fontSize: 11, color: item.trendColor || 'var(--color-text-tertiary)', marginTop: 7, fontWeight: item.trendColor ? 700 : 500 }}>
            {item.trend}
          </div>
        </div>
        {item.sparkline && <Sparkline data={item.sparkline} />}
      </div>
      {item.detail && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 10, fontSize: 11, color: item.detailColor || 'var(--color-text-tertiary)', fontWeight: item.detailColor ? 700 : 500 }}>
          {item.pulse && <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--color-danger-500)', animation: 'pulseDot 1s ease-in-out infinite' }} />}
          {item.detail}
        </div>
      )}
      {item.secondary && <div style={{ marginTop: 4, fontSize: 11, color: item.secondaryColor || 'var(--color-text-tertiary)', fontWeight: 700 }}>{item.secondary}</div>}
    </div>
  )
}

function MiniBadge({ children, tone = 'neutral' }) {
  const colors = {
    danger: ['var(--color-danger-50)', 'var(--color-danger-700)', 'var(--color-danger-200)'],
    warning: ['var(--color-warning-50)', 'var(--color-warning-700)', 'var(--color-warning-200)'],
    orange: ['#fff7ed', '#c2410c', '#fed7aa'],
    success: ['var(--color-success-50)', 'var(--color-success-700)', 'var(--color-success-200)'],
    info: ['var(--color-brand-50)', 'var(--color-brand-700)', 'var(--color-brand-200)'],
    neutral: ['var(--color-bg-muted)', 'var(--color-text-secondary)', 'var(--color-border-muted)'],
  }[tone]
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', border: `1px solid ${colors[2]}`, background: colors[0], color: colors[1], borderRadius: 999, padding: '2px 7px', fontSize: 10, fontWeight: 800, whiteSpace: 'nowrap' }}>
      {children}
    </span>
  )
}

function AlertItem({ item }) {
  const config = {
    urgente: { icon: AlertTriangle, label: 'URGENTE', tone: 'danger', bg: 'var(--color-danger-50)', border: 'var(--color-danger-500)', color: 'var(--color-danger-600)' },
    atencao: { icon: Clock, label: 'ATENCAO', tone: 'warning', bg: 'var(--color-warning-50)', border: 'var(--color-warning-400)', color: 'var(--color-warning-600)' },
    vencimento: { icon: Clock, label: 'ATENCAO', tone: 'warning', bg: 'var(--color-warning-50)', border: 'var(--color-warning-400)', color: 'var(--color-warning-600)' },
    estoque: { icon: TrendingDown, label: 'ESTOQUE BAIXO', tone: 'orange', bg: '#fff7ed', border: '#fb923c', color: '#c2410c' },
    bloqueado: { icon: Lock, label: 'BLOQUEADO', tone: 'neutral', bg: 'var(--color-bg-subtle)', border: 'var(--color-slate-400, #94a3b8)', color: 'var(--color-text-secondary)' },
  }[item.tipo] || {}
  const Icon = config.icon || AlertTriangle
  const subtitle = item.tipo === 'estoque'
    ? `Estoque: ${Number(item.quantidade || 0)} / Min: ${Number(item.estoque_minimo || 0)}`
    : item.tipo === 'bloqueado'
      ? `Bloqueado ha ${Number(item.dias_bloqueado || 0)} dias`
      : `Vence em ${Number(item.dias || 0)} dias · Qtd: ${Number(item.quantidade || 0)} un`

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, borderLeft: `3px solid ${config.border}`, background: config.bg, borderRadius: 8, padding: '10px 12px', marginBottom: 6 }}>
      <Icon size={14} color={config.color} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {item.tipo === 'estoque' ? item.produto : `${item.lote} - ${item.produto}`}
        </div>
        <div style={{ fontSize: 11, color: config.color, marginTop: 2 }}>{subtitle}</div>
      </div>
      <MiniBadge tone={config.tone}>{config.label}</MiniBadge>
    </div>
  )
}

function Gauge({ value }) {
  const clamped = Math.max(0, Math.min(180, Number(value || 0)))
  const dash = 188
  const offset = dash - (dash * Math.min(clamped, 120)) / 120
  const color = value < 30 ? 'var(--color-danger-600)' : value <= 90 ? 'var(--color-warning-600)' : 'var(--color-success-600)'
  return (
    <div style={{ position: 'relative', width: 210, height: 118, margin: '0 auto' }}>
      <svg viewBox="0 0 220 120" width="210" height="118">
        <path d="M30 100 A80 80 0 0 1 190 100" fill="none" stroke="var(--color-bg-muted)" strokeWidth="14" strokeLinecap="round" />
        <path d="M30 100 A80 80 0 0 1 190 100" fill="none" stroke={color} strokeWidth="14" strokeLinecap="round" strokeDasharray={dash} strokeDashoffset={offset} />
      </svg>
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 18, textAlign: 'center' }}>
        <div style={{ fontSize: 24, fontWeight: 800, lineHeight: 1 }}>{Math.round(Number(value || 0))} dias</div>
        <div style={{ fontSize: 11, color: 'var(--color-text-tertiary)', marginTop: 4 }}>validade media</div>
      </div>
    </div>
  )
}

export default function Dashboard() {
  const toast = useToast()
  const [kpis, setKpis] = useState(null)
  const [movData, setMovData] = useState([])
  const [alertasBase, setAlertasBase] = useState({ total: 0, alertas: [] })
  const [alertasPendentes, setAlertasPendentes] = useState({ total: 0, itens: [] })
  const [ocupacao, setOcupacao] = useState({ total_posicoes: 0, ocupadas: 0, percentual: 0, corredores: [] })
  const [topProdutos, setTopProdutos] = useState([])
  const [operadores, setOperadores] = useState([])
  const [saudeEstoque, setSaudeEstoque] = useState(null)
  const [recentes, setRecentes] = useState([])
  const [loading, setLoading] = useState(true)
  const [activePie, setActivePie] = useState(null)
  const [alertTab, setAlertTab] = useState('todos')
  const [topPeriodo, setTopPeriodo] = useState('mes')
  const scrollRef = useRef(null)
  const [isDragging, setIsDragging] = useState(false)
  const [startX, setStartX] = useState(0)
  const [scrollLeft, setScrollLeft] = useState(0)

  async function load() {
    setLoading(true)
    try {
      const [kpisRes, movRes, alertasRes, alertasPendRes, ocupacaoRes, topProdRes, operadoresRes, saudeRes, recentesRes] = await Promise.all([
        api.get('/dashboard/kpis'),
        api.get('/dashboard/movimentacoes'),
        api.get('/dashboard/alertas'),
        api.get('/dashboard/alertas-pendentes'),
        api.get('/dashboard/ocupacao-corredores'),
        api.get('/dashboard/top-produtos', { params: { periodo: topPeriodo === 'semana' ? 'semana' : 'mes' } }),
        api.get('/dashboard/operadores-hoje'),
        api.get('/dashboard/saude-estoque'),
        api.get('/movimentacoes', { params: { limit: 8, order: 'desc' } }),
      ])
      setKpis(kpisRes.data)
      setMovData((movRes.data || []).map(d => ({
        dataLonga: fmtDateLong(d.dia),
        dia: new Date(d.dia).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
        entradas: Number(d.entradas || 0),
        saidas: Number(d.saidas || 0),
        transferencias: Number(d.transferencias || 0),
        ajustes: Number(d.ajustes || 0),
      })))
      setAlertasBase(alertasRes.data || { total: 0, alertas: [] })
      setAlertasPendentes(alertasPendRes.data || { total: 0, itens: [] })
      setOcupacao(ocupacaoRes.data || { total_posicoes: 0, ocupadas: 0, percentual: 0, corredores: [] })
      setTopProdutos(topProdRes.data || [])
      setOperadores(operadoresRes.data || [])
      setSaudeEstoque(saudeRes.data || null)
      setRecentes(recentesRes.data?.data || [])
    } catch (err) {
      console.error(err)
      toast.error('Erro ao carregar dados do dashboard.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [topPeriodo])

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

  const movTrend = kpis ? trendPercent(kpis.movimentacoes_hoje, kpis.movimentacoes_ontem) : 0
  const kpiItems = kpis ? [
    {
      label: 'Movimentacoes Hoje',
      value: kpis.movimentacoes_hoje ?? '-',
      icon: Activity,
      trend: `${movTrend >= 0 ? '↑' : '↓'} ${Math.abs(movTrend)}% vs ontem`,
      trendColor: movTrend >= 0 ? 'var(--color-success-600)' : 'var(--color-danger-600)',
      sparkline: kpis.sparkline_movimentacoes,
    },
    {
      label: 'Total Produtos',
      value: kpis.total_produtos ?? '-',
      icon: Package,
      trend: `${Number(kpis.lotes_abaixo_minimo || 0)} abaixo do minimo`,
      trendColor: Number(kpis.lotes_abaixo_minimo || 0) > 0 ? 'var(--color-danger-600)' : 'var(--color-text-tertiary)',
      detail: Number(kpis.lotes_abaixo_minimo || 0) > 0 ? 'Requer reposicao de estoque' : 'Estoque dentro dos limites',
      detailColor: Number(kpis.lotes_abaixo_minimo || 0) > 0 ? 'var(--color-danger-600)' : 'var(--color-success-600)',
      pulse: Number(kpis.lotes_abaixo_minimo || 0) > 0,
    },
    {
      label: 'Lotes Vencendo',
      value: kpis.lotes_vencendo ?? '-',
      icon: Layers,
      color: 'var(--color-warning-600)',
      trend: `${Number(kpis.vencem_semana || 0)} vencem esta semana`,
      trendColor: 'var(--color-danger-600)',
      secondary: `${Number(kpis.vencem_mes || 0)} vencem este mes`,
      secondaryColor: 'var(--color-warning-600)',
    },
    {
      label: 'Lotes Bloqueados',
      value: kpis.lotes_bloqueados ?? '-',
      icon: AlertTriangle,
      color: 'var(--color-danger-600)',
      trend: kpis.ultimo_bloqueio_dias != null ? `Ultimo bloqueio: ha ${Number(kpis.ultimo_bloqueio_dias)} dias` : 'Sem bloqueios recentes',
    },
  ] : []

  const pieData = [
    { name: 'Entradas', value: movData.reduce((acc, d) => acc + d.entradas, 0), color: MOV_COLORS.entradas },
    { name: 'Saidas', value: movData.reduce((acc, d) => acc + d.saidas, 0), color: MOV_COLORS.saidas },
    { name: 'Transferencias', value: movData.reduce((acc, d) => acc + d.transferencias, 0), color: MOV_COLORS.transferencias },
    { name: 'Ajustes', value: movData.reduce((acc, d) => acc + d.ajustes, 0), color: MOV_COLORS.ajustes },
  ].filter(d => d.value > 0)
  const pieTotal = pieData.reduce((acc, d) => acc + d.value, 0)

  const filteredAlertas = (alertasPendentes.itens || []).filter(item => {
    if (alertTab === 'todos') return true
    if (alertTab === 'vencimento') return ['urgente', 'atencao', 'vencimento'].includes(item.tipo)
    if (alertTab === 'estoque') return item.tipo === 'estoque'
    return item.tipo === 'bloqueado'
  })

  const corredores = Object.entries(CORREDORES).map(([zona, nome]) => {
    const found = (ocupacao.corredores || []).find(item => item.zona === zona)
    return {
      zona,
      nome,
      total_posicoes: Number(found?.total_posicoes || 0),
      ocupadas: Number(found?.ocupadas || 0),
      percentual: Number(found?.percentual || 0),
    }
  })
  const maxTop = Math.max(...topProdutos.map(p => Number(p.total_movimentado || 0)), 1)

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

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,minmax(0,1fr))', gap: 16, marginBottom: 24 }}>
        {loading ? Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />) : kpiItems.map(item => <KpiCard key={item.label} item={item} />)}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 3fr) minmax(280px, 2fr)', gap: 16, marginBottom: 24 }}>
        <div className="card">
          <div className="card-header">
            <span className="card-title">Movimentacoes por Dia - Ultimos 30 dias</span>
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
                        <Bar dataKey="entradas" name="Entradas" fill={MOV_COLORS.entradas} radius={[3, 3, 0, 0]} barSize={6} animationDuration={800} animationEasing="ease-out" />
                        <Bar dataKey="saidas" name="Saidas" fill={MOV_COLORS.saidas} radius={[3, 3, 0, 0]} barSize={6} animationDuration={800} animationEasing="ease-out" />
                        <Bar dataKey="transferencias" name="Transferencias" fill={MOV_COLORS.transferencias} radius={[3, 3, 0, 0]} barSize={6} animationDuration={800} animationEasing="ease-out" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'center', gap: 18, fontSize: 12, color: 'var(--color-text-secondary)', marginTop: 8 }}>
                  {[
                    ['Entradas', MOV_COLORS.entradas],
                    ['Saidas', MOV_COLORS.saidas],
                    ['Transferencias', MOV_COLORS.transferencias],
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
            <span className="card-title">Distribuicao por Tipo</span>
          </div>
          <div style={{ padding: '8px 20px 18px' }}>
            {loading ? (
              <div style={{ height: 240, background: 'var(--color-bg-subtle)', borderRadius: 8, animation: 'shimmer 1.2s ease-in-out infinite' }} />
            ) : pieTotal === 0 ? (
              <div style={{ height: 240, display: 'grid', placeItems: 'center', color: 'var(--color-text-tertiary)', fontSize: 13 }}>Sem movimentacoes no periodo</div>
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
                        {pieData.map(entry => <Cell key={entry.name} fill={entry.color} />)}
                      </Pie>
                      <Tooltip content={<PieTooltip total={pieTotal} />} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', pointerEvents: 'none' }}>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: 24, fontWeight: 800, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>{pieTotal}</div>
                      <div style={{ fontSize: 11, color: 'var(--color-text-tertiary)', marginTop: 4 }}>movimentacoes</div>
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

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 16, marginBottom: 24 }}>
        <div className="card">
          <div className="card-header">
            <span className="card-title">Alertas Pendentes</span>
            <MiniBadge tone="danger">{alertasPendentes.total || alertasBase.total || 0}</MiniBadge>
          </div>
          <div style={{ padding: '0 20px 18px' }}>
            <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
              {[
                ['todos', 'Todos'],
                ['vencimento', 'Vencimento'],
                ['estoque', 'Estoque'],
                ['bloqueados', 'Bloqueados'],
              ].map(([id, label]) => (
                <button key={id} type="button" onClick={() => setAlertTab(id)} className={`btn btn-sm ${alertTab === id ? 'btn-primary' : 'btn-outline'}`} style={{ height: 30 }}>
                  {label}
                </button>
              ))}
            </div>
            {loading ? (
              <SkeletonCard height={260} />
            ) : filteredAlertas.length === 0 ? (
              <div style={{ height: 220, display: 'grid', placeItems: 'center', color: 'var(--color-text-tertiary)', fontSize: 13 }}>Nenhum alerta pendente.</div>
            ) : (
              <div style={{ maxHeight: 280, overflowY: 'auto', paddingRight: 4 }}>
                {filteredAlertas.map((item, index) => <AlertItem key={`${item.lote}-${item.tipo}-${index}`} item={item} />)}
              </div>
            )}
            <a href="/alertas" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 12, fontSize: 12, color: 'var(--color-brand-600)', fontWeight: 700 }}>Ver todos os alertas <ArrowRight size={12} /></a>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <span className="card-title">Ocupacao do Armazem</span>
            <MiniBadge tone={ocupacao.percentual > 90 ? 'danger' : ocupacao.percentual >= 70 ? 'warning' : 'success'}>{Number(ocupacao.percentual || 0)}% ocupado</MiniBadge>
          </div>
          <div style={{ padding: '0 20px 18px' }}>
            {loading ? (
              <SkeletonCard height={280} />
            ) : (
              <>
                <div style={{ marginBottom: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 700, marginBottom: 7 }}>
                    <span>Ocupacao geral</span>
                    <span style={{ color: 'var(--color-text-tertiary)', fontWeight: 500 }}>{Number(ocupacao.ocupadas || 0)} de {Number(ocupacao.total_posicoes || 0)} posicoes ocupadas</span>
                  </div>
                  <div style={{ height: 8, borderRadius: 999, background: 'var(--color-bg-muted)', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${Math.min(100, Number(ocupacao.percentual || 0))}%`, background: pctColor(Number(ocupacao.percentual || 0)), borderRadius: 999 }} />
                  </div>
                </div>
                <div>
                  {corredores.map((row, index) => (
                    <div key={row.zona} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: index < corredores.length - 1 ? '1px solid var(--color-border-muted)' : 'none' }}>
                      <div style={{ width: 58, fontFamily: '"IBM Plex Mono", monospace', fontSize: 12, fontWeight: 700 }}>{row.zona}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{ flex: 1, height: 6, borderRadius: 999, background: 'var(--color-bg-muted)', overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${Math.min(100, row.percentual)}%`, borderRadius: 999, background: pctColor(row.percentual) }} />
                          </div>
                          <div style={{ width: 42, textAlign: 'right', fontSize: 12, fontWeight: 800 }}>{row.percentual}%</div>
                          <MiniBadge>{row.total_posicoes} pos</MiniBadge>
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--color-text-tertiary)', marginTop: 3 }}>{row.nome}</div>
                      </div>
                    </div>
                  ))}
                </div>
                <a href="/mapa" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 12, fontSize: 12, color: 'var(--color-brand-600)', fontWeight: 700 }}>Ver mapa completo <ArrowRight size={12} /></a>
              </>
            )}
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,minmax(0,1fr))', gap: 16, marginBottom: 24 }}>
        <div className="card">
          <div className="card-header">
            <span className="card-title">Mais Movimentados</span>
            <select className="input" value={topPeriodo} onChange={e => setTopPeriodo(e.target.value)} style={{ width: 132, height: 32, fontSize: 12 }}>
              <option value="mes">Este mes</option>
              <option value="semana">Esta semana</option>
            </select>
          </div>
          <div style={{ padding: '0 20px 18px' }}>
            {loading ? <SkeletonCard height={250} /> : topProdutos.length === 0 ? (
              <div style={{ height: 220, display: 'grid', placeItems: 'center', color: 'var(--color-text-tertiary)', fontSize: 13 }}>Sem movimentacoes no periodo.</div>
            ) : topProdutos.map((item, index) => {
              const total = Number(item.total_movimentado || 0)
              return (
                <div key={item.nome} style={{ marginBottom: 14 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 6 }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>#{index + 1} {item.nome}</div>
                      <div style={{ fontSize: 11, color: 'var(--color-text-tertiary)', marginTop: 1 }}>{total.toLocaleString('pt-BR')} un movimentadas</div>
                    </div>
                    <MiniBadge tone="info">{item.categoria || 'Produto'}</MiniBadge>
                  </div>
                  <div style={{ height: 7, borderRadius: 999, background: 'var(--color-brand-100)', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${Math.max(8, (total / maxTop) * 100)}%`, borderRadius: 999, background: 'var(--color-brand-600)' }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <span className="card-title">Equipe Hoje</span>
          </div>
          <div style={{ padding: '0 20px 18px' }}>
            {loading ? <SkeletonCard height={250} /> : operadores.filter(op => Number(op.total_hoje || 0) > 0).length === 0 ? (
              <div style={{ height: 220, display: 'grid', placeItems: 'center', color: 'var(--color-text-tertiary)', fontSize: 13 }}>Nenhuma movimentacao registrada hoje.</div>
            ) : operadores.filter(op => Number(op.total_hoje || 0) > 0).slice(0, 5).map(op => {
              const initials = (op.nome || '?').split(' ').slice(0, 2).map(part => part[0]).join('').toUpperCase()
              return (
                <div key={op.nome} style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '10px 0', borderBottom: '1px solid var(--color-border-muted)' }}>
                  <div style={{ width: 34, height: 34, borderRadius: 8, display: 'grid', placeItems: 'center', background: 'var(--color-brand-100)', color: 'var(--color-brand-700)', fontSize: 12, fontWeight: 800 }}>{initials}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{op.nome}</div>
                    <div style={{ fontSize: 11, color: 'var(--color-text-tertiary)', marginTop: 2 }}>{Number(op.total_hoje || 0)} movimentacoes hoje · Ultima atividade: {fmtTime(op.ultima_atividade)}</div>
                  </div>
                  <MiniBadge tone={op.perfil === 'administrador' ? 'info' : 'neutral'}>{op.perfil === 'administrador' ? 'Administrador' : 'Operador'}</MiniBadge>
                </div>
              )
            })}
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <span className="card-title">Saude do Estoque</span>
          </div>
          <div style={{ padding: '0 20px 18px' }}>
            {loading ? <SkeletonCard height={250} /> : (
              <>
                <Gauge value={saudeEstoque?.media_dias || 0} />
                <div style={{ display: 'grid', gap: 9, marginTop: 6, fontSize: 12 }}>
                  {[
                    [ShieldCheck, 'var(--color-success-600)', `${Number(saudeEstoque?.saudaveis || 0)} lotes saudaveis (> 90 dias)`],
                    [Clock, 'var(--color-warning-600)', `${Number(saudeEstoque?.atencao || 0)} lotes em atencao (30-90 dias)`],
                    [AlertTriangle, 'var(--color-danger-600)', `${Number(saudeEstoque?.criticos || 0)} lotes criticos (< 30 dias)`],
                  ].map(([Icon, color, label]) => (
                    <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--color-text-secondary)' }}>
                      <Icon size={14} color={color} /> <span>{label}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <span className="card-title">Movimentacoes recentes</span>
          <a href="/historico" style={{ fontSize: 12, color: 'var(--color-brand-600)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}>Ver historico completo <ArrowRight size={12} /></a>
        </div>
        <div>
          {loading ? (
            Array.from({ length: 8 }).map((_, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 20px', borderBottom: '1px solid var(--color-border-muted)' }}>
                <div style={{ width: 34, height: 34, borderRadius: 8, background: 'var(--color-bg-muted)', flexShrink: 0, animation: 'shimmer 1.2s ease-in-out infinite' }} />
                <div style={{ flex: 1 }}>
                  <div style={{ height: 13, width: '60%', background: 'var(--color-bg-muted)', borderRadius: 4, marginBottom: 6, animation: 'shimmer 1.2s ease-in-out infinite' }} />
                  <div style={{ height: 11, width: '40%', background: 'var(--color-bg-muted)', borderRadius: 4, animation: 'shimmer 1.2s ease-in-out infinite' }} />
                </div>
              </div>
            ))
          ) : recentes.length === 0 ? (
            <div style={{ padding: '32px 20px', textAlign: 'center', color: 'var(--color-text-tertiary)', fontSize: 13 }}>Nenhuma movimentacao registrada</div>
          ) : recentes.map((r, i) => {
            const tipo = r.tipo || r.tipo_movimentacao
            const isEntrada = tipo === 'entrada'
            const isSaida = tipo === 'saida'
            const isTransferencia = tipo === 'transferencia'
            const localizacao = r.localizacao_nome || r.localizacao_destino_nome || r.localizacao_origem_nome || '-'
            return (
              <div key={r.id || r.id_movimentacao || i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 20px', borderBottom: i < recentes.length - 1 ? '1px solid var(--color-border-muted)' : 'none' }}>
                <div style={{ width: 34, height: 34, borderRadius: 8, display: 'grid', placeItems: 'center', flexShrink: 0, background: isEntrada ? 'var(--color-success-100)' : isSaida ? 'var(--color-danger-100)' : 'var(--color-brand-100)', color: isEntrada ? 'var(--color-success-600)' : isSaida ? 'var(--color-danger-600)' : 'var(--color-brand-600)' }}>
                  {isEntrada ? <ArrowDownLeft size={15} /> : isSaida ? <ArrowUpRight size={15} /> : isTransferencia ? <ArrowRight size={15} /> : <Circle size={12} />}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.produto_nome || r.codigo_lote || '-'}</div>
                  <div style={{ fontSize: 11, color: 'var(--color-text-tertiary)', marginTop: 2 }}>{r.codigo_lote || r.numero_lote || '-'} · {fmtTipo(tipo)} · {localizacao}</div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 800, color: isEntrada ? 'var(--color-success-600)' : isSaida ? 'var(--color-danger-600)' : 'var(--color-brand-600)' }}>
                    {isEntrada ? '+' : isSaida ? '-' : ''}{Number(r.quantidade || 0)} un
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--color-text-tertiary)' }}>{r.usuario_nome || 'Operador'} · {fmtTime(r.criado_em || r.data_movimentacao)}</div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <style>{`
        @keyframes shimmer { 0%,100%{opacity:1} 50%{opacity:0.5} }
        @keyframes pulseDot { 0%,100%{transform:scale(1);opacity:1} 50%{transform:scale(1.6);opacity:.5} }
        @media (max-width: 1180px) {
          [style*="repeat(4,minmax(0,1fr))"] { grid-template-columns: repeat(2,minmax(0,1fr)) !important; }
          [style*="repeat(3,minmax(0,1fr))"] { grid-template-columns: 1fr !important; }
        }
        @media (max-width: 900px) {
          [style*="minmax(0, 3fr)"] { grid-template-columns: 1fr !important; }
          [style*="repeat(2,minmax(0,1fr))"] { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </Layout>
  )
}
