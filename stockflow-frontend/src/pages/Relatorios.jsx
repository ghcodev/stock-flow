import { useState } from 'react'
import Layout from '../components/Layout.jsx'
import { useToast } from '../context/ToastContext.jsx'
import api from '../api/axios.js'
import {
  Download, Calendar, Shuffle, Package, Clock, ClipboardList,
  FileText, RefreshCw, BarChart2, X,
} from 'lucide-react'

/* ─── Report definitions ───────────────────────────────────── */
const REPORTS = {
  movimentacoes: {
    titulo: 'Movimentações por Período',
    label:  'Movimentações',
    desc:   'Entradas, saídas e transferências',
    icone:  Shuffle,
    colunas: ['Data', 'Tipo', 'Produto', 'Lote', 'Quantidade', 'Operador', 'Localização'],
  },
  estoque_atual: {
    titulo: 'Estoque Atual',
    label:  'Estoque',
    desc:   'Posição atual de todos os lotes',
    icone:  Package,
    colunas: ['Nº Lote', 'Produto', 'Validade', 'Dias Restantes', 'Quantidade', 'Status', 'Localização'],
  },
  lotes_vencendo: {
    titulo: 'Lotes Vencendo',
    label:  'Vencimento',
    desc:   'Lotes com validade próxima',
    icone:  Clock,
    colunas: ['Nº Lote', 'Produto', 'Validade', 'Dias para Vencer', 'Quantidade', 'Localização'],
  },
  inventario: {
    titulo: 'Acurácia de Inventário',
    label:  'Inventário',
    desc:   'Resultado dos inventários rotativos',
    icone:  ClipboardList,
    colunas: ['Data', 'Corredor', 'Posições', 'Conferidas', 'Divergências', 'Acuracidade', 'Operador'],
  },
}

/* ─── Pure helpers ─────────────────────────────────────────── */
function toDateInput(date) {
  return date.toISOString().slice(0, 10)
}

function formatDate(value) {
  return value ? new Date(value).toLocaleDateString('pt-BR') : '-'
}

function formatDateTime(value) {
  return value ? new Date(value).toLocaleString('pt-BR') : '-'
}

function localizacao(m) {
  if (m.tipo === 'transferencia') return `${m.localizacao_origem_nome || '-'} → ${m.localizacao_destino_nome || '-'}`
  if (m.tipo === 'entrada') return m.localizacao_destino_nome || m.localizacao_nome || '-'
  if (m.tipo === 'saida')   return m.localizacao_origem_nome  || m.localizacao_nome || '-'
  return m.localizacao_nome || '-'
}

function csvValue(value) {
  const text = String(value ?? '')
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

/* ─── Sub-components ───────────────────────────────────────── */
function SkeletonTable({ cols }) {
  return (
    <tbody>
      {Array.from({ length: 5 }).map((_, row) => (
        <tr key={row}>
          {Array.from({ length: cols }).map((_, col) => (
            <td key={col}>
              <div className="skeleton" style={{ height: 13 }} />
            </td>
          ))}
        </tr>
      ))}
    </tbody>
  )
}

function RelKpiCard({ icon: Icon, label, value, valueStyle }) {
  return (
    <div className="rel-kpi-card">
      <div className="rel-kpi-icon"><Icon size={16} /></div>
      <div style={{ minWidth: 0 }}>
        <div className="rel-kpi-label">{label}</div>
        <div className="rel-kpi-value" style={valueStyle}>{value}</div>
      </div>
    </div>
  )
}

/* ─── Main component ───────────────────────────────────────── */
export default function Relatorios() {
  const toast = useToast()

  const [tipo,           setTipo]           = useState('movimentacoes')
  const [inicio,         setInicio]         = useState(toDateInput(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)))
  const [fim,            setFim]            = useState(toDateInput(new Date()))
  const [loading,        setLoading]        = useState(false)
  const [rows,           setRows]           = useState([])
  const [generatedAt,    setGeneratedAt]    = useState(null)
  const [gerarCount,     setGerarCount]     = useState(0)
  // Per-type extra filters
  const [movFilter,      setMovFilter]      = useState('todos')
  const [statusFilter,   setStatusFilter]   = useState('todos')
  const [prazoFilter,    setPrazoFilter]    = useState('30')
  const [corredorFilter, setCorredorFilter] = useState('')

  const report     = REPORTS[tipo]
  const ReportIcon = report.icone
  const diasPeriodo = (() => {
    const diff = Math.round((new Date(fim) - new Date(inicio)) / 86400000) + 1
    return Number.isFinite(diff) && diff > 0 ? diff : 1
  })()

  /* ── State transitions ─────────────────────────────────── */
  function changeTipo(newTipo) {
    setTipo(newTipo)
    setRows([])
    setGeneratedAt(null)
  }

  function clearReport() {
    setRows([])
    setGeneratedAt(null)
  }

  /* ── Helpers ─────────────────────────────────────────────── */
  function inPeriod(value) {
    if (!value) return true
    const date = new Date(value)
    const min  = new Date(`${inicio}T00:00:00`)
    const max  = new Date(`${fim}T23:59:59`)
    return date >= min && date <= max
  }

  /* ── API (logic preserved for all existing types) ────────── */
  async function gerarRelatorio() {
    setLoading(true)
    setRows([])
    try {
      if (tipo === 'movimentacoes') {
        const { data } = await api.get('/movimentacoes', { params: { limit: 500 } })
        let items = (data.data || []).filter(m => inPeriod(m.data_movimentacao || m.criado_em))
        if (movFilter !== 'todos') items = items.filter(m => m.tipo === movFilter)
        setRows(items.map(m => ({
          Data:        formatDateTime(m.data_movimentacao || m.criado_em),
          Tipo:        m.tipo,
          Produto:     m.produto_nome || '-',
          Lote:        m.numero_lote  || m.codigo_lote || m.id_lote,
          Quantidade:  m.quantidade,
          Operador:    m.usuario_nome || '-',
          Localização: localizacao(m),
        })))
      }

      if (tipo === 'estoque_atual') {
        const { data } = await api.get('/lotes', { params: { limit: 500 } })
        let items = data.data || []
        if (statusFilter !== 'todos') {
          items = items.filter(l => (l.status_lote || l.status)?.toLowerCase() === statusFilter)
        }
        setRows(items.map(l => ({
          'Nº Lote':       l.numero_lote || l.codigo || l.id,
          Produto:         l.produto_nome || '-',
          Validade:        formatDate(l.data_validade),
          'Dias Restantes': l.dias_para_vencer ?? '-',
          Quantidade:      l.quantidade,
          Status:          l.status_lote || l.status || '-',
          Localização:     l.corredor ? `${l.corredor}-N${l.nivel}-P${l.posicao}` : (l.localizacao_nome || '-'),
        })))
      }

      if (tipo === 'lotes_vencendo') {
        const { data } = await api.get('/lotes', { params: { limit: 500 } })
        const prazoNum = Number(prazoFilter) || 30
        const items = (data.data || [])
          .filter(l => {
            const dias = l.dias_para_vencer != null
              ? Number(l.dias_para_vencer)
              : (l.data_validade ? Math.floor((new Date(l.data_validade) - Date.now()) / 86400000) : null)
            return dias !== null && dias <= prazoNum
          })
          .sort((a, b) => (a.dias_para_vencer ?? 999) - (b.dias_para_vencer ?? 999))
        setRows(items.map(l => ({
          'Nº Lote':          l.numero_lote || l.codigo || l.id,
          Produto:            l.produto_nome || '-',
          Validade:           formatDate(l.data_validade),
          'Dias para Vencer': l.dias_para_vencer ?? '-',
          Quantidade:         l.quantidade,
          Localização:        l.corredor ? `${l.corredor}-N${l.nivel}-P${l.posicao}` : (l.localizacao_nome || '-'),
        })))
      }

      if (tipo === 'inventario') {
        const { data } = await api.get('/inventarios', { params: { limit: 500 } })
        let items = (data.data || []).filter(i => inPeriod(i.inicio || i.criado_em))
        if (corredorFilter.trim()) {
          items = items.filter(i => i.corredor?.toLowerCase().includes(corredorFilter.trim().toLowerCase()))
        }
        setRows(items.map(i => ({
          Data:         formatDateTime(i.inicio || i.criado_em),
          Corredor:     i.corredor || '-',
          Posições:     i.total    || i.total_posicoes  || 0,
          Conferidas:   i.conferidos || i.total_conferidas || 0,
          Divergências: i.divergencias || 0,
          Acuracidade:  `${Number(i.acuracidade || 0).toFixed(1)}%`,
          Operador:     i.usuario_nome || '-',
        })))
      }

      setGerarCount(prev => prev + 1)
      setGeneratedAt(new Date())
      toast.success('Relatório gerado com sucesso.')
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erro ao gerar relatório.')
    } finally {
      setLoading(false)
    }
  }

  function exportCSV() {
    if (!rows.length) {
      toast.warning('Gere um relatório antes de exportar.')
      return
    }
    const csv = [report.colunas, ...rows.map(row => report.colunas.map(col => row[col]))]
      .map(r => r.map(csvValue).join(','))
      .join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = `${tipo}-relatorio-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  /* ── Render ──────────────────────────────────────────────── */
  return (
    <Layout breadcrumb={['Análise', 'Relatórios']}>
      <div className="page-header">
        <div className="page-header-left">
          <h1>Relatórios</h1>
          <div className="subtitle">
            <span>Análises operacionais</span>
            <span className="sep" />
            <span>Exportação CSV</span>
          </div>
        </div>
        <div className="page-header-actions">
          <button type="button" className="btn btn-outline btn-sm" onClick={exportCSV}>
            <Download size={14} /> Exportar
          </button>
          <button type="button" className="btn btn-primary" onClick={gerarRelatorio} disabled={loading}>
            {loading
              ? <><RefreshCw size={14} className="spin" /> Gerando...</>
              : <><FileText size={14} /> Gerar relatório</>
            }
          </button>
        </div>
      </div>

      {/* KPI Strip */}
      <div className="rel-kpi-grid">
        <RelKpiCard icon={FileText}   label="Relatórios Gerados"   value={gerarCount} />
        <RelKpiCard icon={BarChart2}  label="Total de Registros"   value={rows.length} />
        <RelKpiCard icon={Calendar}   label="Período Selecionado"  value={`${diasPeriodo}d`} />
        <RelKpiCard
          icon={ReportIcon}
          label="Tipo Ativo"
          value={report.label}
          valueStyle={{ fontSize: 16, lineHeight: 1.35, fontWeight: 800, color: 'var(--color-text-primary)' }}
        />
      </div>

      {/* Summary banner */}
      {generatedAt && (
        <div className="rel-summary-banner">
          <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', display: 'flex', flexWrap: 'wrap', gap: '0 6px', alignItems: 'center' }}>
            <strong style={{ color: 'var(--color-text-primary)' }}>Relatório: {report.titulo}</strong>
            <span style={{ color: 'var(--color-border-strong)' }}>·</span>
            <span>Período: {formatDate(inicio)} a {formatDate(fim)}</span>
            <span style={{ color: 'var(--color-border-strong)' }}>·</span>
            <strong style={{ color: 'var(--color-text-primary)' }}>{rows.length}</strong>
            <span>registros</span>
            <span style={{ color: 'var(--color-border-strong)' }}>·</span>
            <span>Gerado às {generatedAt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
          </div>
          <button type="button" className="btn btn-outline btn-sm" onClick={clearReport} style={{ flexShrink: 0 }}>
            <X size={13} /> Limpar
          </button>
        </div>
      )}

      {/* Type selector cards */}
      <div className="rel-type-grid">
        {Object.entries(REPORTS).map(([key, cfg]) => {
          const Icon   = cfg.icone
          const active = tipo === key
          return (
            <button
              key={key}
              type="button"
              className={`rel-type-card${active ? ' active' : ''}`}
              onClick={() => changeTipo(key)}
            >
              <div className={`rel-type-icon-wrap${active ? ' active' : ''}`}>
                <Icon size={18} style={{ color: active ? 'var(--color-brand-600)' : 'var(--color-text-secondary)' }} />
              </div>
              <div className="rel-type-title">{cfg.titulo}</div>
              <div className="rel-type-desc">{cfg.desc}</div>
            </button>
          )
        })}
      </div>

      {/* Filters row */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ padding: '14px 20px', display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div className="form-group" style={{ marginBottom: 0, minWidth: 145 }}>
            <label className="form-label">Início</label>
            <input className="input" type="date" value={inicio} onChange={e => setInicio(e.target.value)} />
          </div>
          <div className="form-group" style={{ marginBottom: 0, minWidth: 145 }}>
            <label className="form-label">Fim</label>
            <input className="input" type="date" value={fim} onChange={e => setFim(e.target.value)} />
          </div>

          {tipo === 'movimentacoes' && (
            <div className="form-group" style={{ marginBottom: 0, minWidth: 160 }}>
              <label className="form-label">Tipo de mov.</label>
              <select className="select" value={movFilter} onChange={e => setMovFilter(e.target.value)}>
                <option value="todos">Todos</option>
                <option value="entrada">Entrada</option>
                <option value="saida">Saída</option>
                <option value="transferencia">Transferência</option>
                <option value="ajuste">Ajuste</option>
              </select>
            </div>
          )}

          {tipo === 'estoque_atual' && (
            <div className="form-group" style={{ marginBottom: 0, minWidth: 160 }}>
              <label className="form-label">Status</label>
              <select className="select" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
                <option value="todos">Todos</option>
                <option value="ativo">Ativo</option>
                <option value="vencido">Vencido</option>
                <option value="zerado">Zerado</option>
              </select>
            </div>
          )}

          {tipo === 'lotes_vencendo' && (
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Prazo (dias)</label>
              <div style={{ display: 'flex', gap: 6 }}>
                {['7', '15', '30', '60'].map(d => (
                  <button
                    key={d}
                    type="button"
                    className={`btn btn-sm ${prazoFilter === d ? 'btn-primary' : 'btn-outline'}`}
                    onClick={() => setPrazoFilter(d)}
                  >
                    {d}d
                  </button>
                ))}
              </div>
            </div>
          )}

          {tipo === 'inventario' && (
            <div className="form-group" style={{ marginBottom: 0, minWidth: 160 }}>
              <label className="form-label">Corredor</label>
              <input
                className="input"
                type="text"
                placeholder="Ex: A, B…"
                value={corredorFilter}
                onChange={e => setCorredorFilter(e.target.value)}
              />
            </div>
          )}
        </div>
      </div>

      {/* Results table */}
      <div className="table-wrap">
        {rows.length > 0 && !loading && (
          <div style={{ padding: '10px 20px', borderBottom: '1px solid var(--color-border-default)', display: 'flex', alignItems: 'center' }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-secondary)' }}>
              {rows.length} registros encontrados
            </span>
          </div>
        )}
        <div className="rel-table-scroll">
          <table className="rel-table">
            <thead>
              <tr>{report.colunas.map(col => <th key={col}>{col}</th>)}</tr>
            </thead>
            {loading
              ? <SkeletonTable cols={report.colunas.length} />
              : (
                <tbody>
                  {rows.length === 0
                    ? (
                      <tr><td colSpan={report.colunas.length}>
                        <div className="empty-state">
                          <div className="empty-icon empty-icon-animated"><FileText size={24} /></div>
                          <div className="empty-title">Selecione o tipo e clique em Gerar relatório</div>
                          <div className="empty-sub">Os dados serão exibidos aqui</div>
                        </div>
                      </td></tr>
                    )
                    : rows.map((row, idx) => (
                      <tr key={idx} className="rel-row">
                        {report.colunas.map(col => (
                          <td
                            key={col}
                            style={{
                              fontSize: 12,
                              fontFamily: ['Data', 'Nº Lote', 'Lote', 'Validade'].includes(col)
                                ? '"IBM Plex Mono",monospace'
                                : undefined,
                            }}
                          >
                            {row[col] ?? '-'}
                          </td>
                        ))}
                      </tr>
                    ))
                  }
                </tbody>
              )
            }
          </table>
        </div>
      </div>

      <style>{`
        @keyframes spin { to{transform:rotate(360deg)} }
        .spin { animation:spin 0.75s linear infinite }

        /* KPI Strip */
        .rel-kpi-grid { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:12px; margin-bottom:16px }
        .rel-kpi-card { display:flex; align-items:center; gap:12px; min-height:74px; padding:12px 14px; background:var(--color-bg-default); border:1px solid var(--color-border-default); border-radius:var(--radius-md); box-shadow:var(--shadow-xs) }
        .rel-kpi-icon { width:30px; height:30px; display:grid; place-items:center; background:var(--color-bg-subtle); border:1px solid var(--color-border-muted); border-radius:var(--radius-sm); flex-shrink:0; color:var(--color-text-secondary) }
        .rel-kpi-label { font-size:10px; font-weight:700; color:var(--color-text-tertiary); text-transform:uppercase; letter-spacing:0.08em }
        .rel-kpi-value { margin-top:2px; font-size:26px; line-height:1; font-weight:800; color:var(--color-text-primary); font-variant-numeric:tabular-nums }

        /* Summary banner */
        .rel-summary-banner { display:flex; justify-content:space-between; align-items:center; gap:16px; padding:12px 16px; background:var(--color-bg-elevated); border:1px solid var(--color-border-default); border-radius:var(--radius-md); margin-bottom:16px }

        /* Type cards */
        .rel-type-grid { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:12px; margin-bottom:16px }
        .rel-type-card { display:flex; flex-direction:column; align-items:flex-start; gap:5px; padding:14px 16px; border:1.5px solid var(--color-border-default); border-radius:var(--radius-lg); cursor:pointer; background:var(--color-bg-default); text-align:left; transition:border-color 100ms,background 100ms }
        .rel-type-card:hover { border-color:var(--color-border-strong); background:var(--color-bg-subtle) }
        .rel-type-card.active { border-color:var(--color-brand-600); background:var(--color-brand-50) }
        .rel-type-icon-wrap { width:34px; height:34px; display:grid; place-items:center; border-radius:var(--radius-md); background:var(--color-bg-subtle); border:1px solid var(--color-border-muted); margin-bottom:6px }
        .rel-type-icon-wrap.active { background:var(--color-brand-100); border-color:var(--color-brand-200) }
        .rel-type-title { font-size:13px; font-weight:700; color:var(--color-text-primary); line-height:1.3 }
        .rel-type-desc { font-size:11px; color:var(--color-text-tertiary); line-height:1.4 }

        /* Table */
        .rel-table-scroll { overflow-x:auto; max-height:calc(100vh - 490px) }
        .rel-table thead th { position:sticky; top:0; z-index:2; background:var(--color-bg-elevated) }
        .rel-row { transition:background 80ms }
        .rel-row:hover { background:var(--color-bg-subtle) }

        @media(max-width:1180px) { .rel-kpi-grid{grid-template-columns:repeat(2,minmax(0,1fr))} .rel-type-grid{grid-template-columns:repeat(2,minmax(0,1fr))} }
        @media(max-width:700px)  { .rel-kpi-grid{grid-template-columns:1fr} .rel-type-grid{grid-template-columns:1fr} .rel-table-scroll{max-height:none} }
      `}</style>
    </Layout>
  )
}

