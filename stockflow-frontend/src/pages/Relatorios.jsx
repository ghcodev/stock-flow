import Layout from '../components/Layout.jsx'
import { Download, FileText, BarChart2, TrendingUp, Calendar, ArrowRight } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts'

const movMensal = [
  { mes: 'Dez/25', entrada: 2840, saida: 2210 },
  { mes: 'Jan/26', entrada: 3120, saida: 2540 },
  { mes: 'Fev/26', entrada: 2980, saida: 2880 },
  { mes: 'Mar/26', entrada: 3450, saida: 3100 },
  { mes: 'Abr/26', entrada: 3200, saida: 2920 },
  { mes: 'Mai/26', entrada: 3842, saida: 3410 },
]

const pieData = [
  { name: 'Antibióticos', value: 28, color: '#2E75B6' },
  { name: 'Infusões',     value: 24, color: '#22c55e' },
  { name: 'Analgésicos',  value: 18, color: '#f59e0b' },
  { name: 'Hormônios',    value: 12, color: '#7c3aed' },
  { name: 'Outros',       value: 18, color: '#94a3b8' },
]

const RELATORIOS = [
  { nome: 'Movimentações por período',    desc: 'Entradas, saídas e transferências filtradas por data', icon: TrendingUp, tipo: 'PDF / XLSX' },
  { nome: 'Inventário geral',             desc: 'Posição atual de estoque com localização e validade',  icon: BarChart2,  tipo: 'PDF / XLSX' },
  { nome: 'Lotes próximos ao vencimento', desc: 'Todos os lotes vencendo nos próximos 30/60/90 dias',  icon: Calendar,   tipo: 'PDF' },
  { nome: 'Auditoria de movimentações',   desc: 'Log imutável com hash SHA-256 para compliance',       icon: FileText,   tipo: 'PDF' },
  { nome: 'Acuracidade do inventário',    desc: 'Resultado dos inventários rotativos por corredor',    icon: BarChart2,  tipo: 'XLSX' },
  { nome: 'Rastreabilidade por lote',     desc: 'Linha do tempo completa de cada lote',                icon: FileText,   tipo: 'PDF' },
]

export default function Relatorios() {
  return (
    <Layout breadcrumb={['Análise', 'Relatórios']}>
      <div className="page-header">
        <div className="page-header-left">
          <h1>Relatórios</h1>
          <div className="subtitle">
            <span>Análises operacionais e de compliance</span>
            <span className="sep" />
            <span>Exportação PDF e XLSX</span>
          </div>
        </div>
        <div className="page-header-actions">
          <button className="btn btn-outline btn-sm"><Calendar size={14} /> Período</button>
        </div>
      </div>

      {/* Charts */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16, marginBottom: 24 }}>
        <div className="card">
          <div className="card-header"><span className="card-title">Movimentações mensais</span></div>
          <div style={{ padding: '8px 20px 20px' }}>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={movMensal} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-default)" vertical={false} />
                <XAxis dataKey="mes" tick={{ fontSize: 11, fill: 'var(--color-text-tertiary)' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: 'var(--color-text-tertiary)' }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid var(--color-border-default)' }} />
                <Bar dataKey="entrada" fill="#2E75B6" radius={[4,4,0,0]} name="Entradas" />
                <Bar dataKey="saida"   fill="#f59e0b" radius={[4,4,0,0]} name="Saídas" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="card">
          <div className="card-header"><span className="card-title">Mix de categorias</span></div>
          <div style={{ padding: '8px 20px 20px' }}>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" outerRadius={72} dataKey="value" label={({ name, value }) => `${value}%`} labelLine={false} fontSize={11}>
                  {pieData.map((e, i) => <Cell key={i} fill={e.color} />)}
                </Pie>
                <Tooltip formatter={(v) => `${v}%`} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Report list */}
      <div className="card">
        <div className="card-header"><span className="card-title">Relatórios disponíveis</span></div>
        <div>
          {RELATORIOS.map((r, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '16px 20px', borderBottom: i < RELATORIOS.length - 1 ? '1px solid var(--color-border-muted)' : 'none' }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: 'var(--color-brand-50)', display: 'grid', placeItems: 'center', color: 'var(--color-brand-600)', flexShrink: 0 }}>
                <r.icon size={18} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--color-text-primary)' }}>{r.nome}</div>
                <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginTop: 2 }}>{r.desc}</div>
              </div>
              <span className="badge badge-neutral">{r.tipo}</span>
              <button className="btn btn-outline btn-sm"><Download size={12} /> Gerar</button>
            </div>
          ))}
        </div>
      </div>
    </Layout>
  )
}
