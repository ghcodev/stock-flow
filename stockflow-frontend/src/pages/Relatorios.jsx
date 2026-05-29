import { useState } from 'react'
import Layout from '../components/Layout.jsx'
import { useToast } from '../context/ToastContext.jsx'
import api from '../api/axios.js'
import { Download, Calendar, ArrowLeftRight, BarChart2, Layers, ClipboardList, FileText, RefreshCw } from 'lucide-react'

const REPORTS = {
  movimentacoes: {
    titulo: 'Movimentações por Período',
    descricao: 'Visualize todas as entradas, saídas e transferências no período selecionado.',
    icone: ArrowLeftRight,
    colunas: ['Data', 'Tipo', 'Produto', 'Lote', 'Quantidade', 'Operador', 'Localização'],
  },
  produtos_movimentados: {
    titulo: 'Produtos Mais Movimentados',
    descricao: 'Ranking dos produtos com maior volume de movimentação no período.',
    icone: BarChart2,
    colunas: ['Produto', 'Categoria', 'Total Entradas', 'Total Saídas', 'Saldo'],
  },
  lotes_status: {
    titulo: 'Lotes por Status',
    descricao: 'Situação atual de todos os lotes: ativos, vencendo, bloqueados e finalizados.',
    icone: Layers,
    colunas: ['Nº Lote', 'Produto', 'Validade', 'Dias Restantes', 'Quantidade', 'Status'],
  },
  inventario: {
    titulo: 'Relatório de Inventário',
    descricao: 'Histórico de inventários realizados com acuracidade e divergências encontradas.',
    icone: ClipboardList,
    colunas: ['Data', 'Corredor', 'Posições', 'Conferidas', 'Divergências', 'Acuracidade', 'Operador'],
  },
}

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
  if (m.tipo === 'transferencia') return `${m.localizacao_origem_nome || '-'} -> ${m.localizacao_destino_nome || '-'}`
  if (m.tipo === 'entrada') return m.localizacao_destino_nome || m.localizacao_nome || '-'
  if (m.tipo === 'saida') return m.localizacao_origem_nome || m.localizacao_nome || '-'
  return m.localizacao_nome || '-'
}

function csvValue(value) {
  const text = String(value ?? '')
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

function SkeletonTable({ cols }) {
  return (
    <tbody>
      {Array.from({ length: 5 }).map((_, row) => (
        <tr key={row}>
          {Array.from({ length: cols }).map((_, col) => (
            <td key={col}><div style={{ height: 13, background: 'var(--color-bg-muted)', borderRadius: 4, animation: 'shimmer 1.2s ease-in-out infinite' }} /></td>
          ))}
        </tr>
      ))}
    </tbody>
  )
}

export default function Relatorios() {
  const toast = useToast()
  const [tipo, setTipo] = useState('movimentacoes')
  const [inicio, setInicio] = useState(toDateInput(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)))
  const [fim, setFim] = useState(toDateInput(new Date()))
  const [loading, setLoading] = useState(false)
  const [rows, setRows] = useState([])
  const [generatedAt, setGeneratedAt] = useState(null)

  const report = REPORTS[tipo]
  const ReportIcon = report.icone

  function inPeriod(value) {
    if (!value) return true
    const date = new Date(value)
    const min = new Date(`${inicio}T00:00:00`)
    const max = new Date(`${fim}T23:59:59`)
    return date >= min && date <= max
  }

  async function gerarRelatorio() {
    setLoading(true)
    setRows([])
    try {
      if (tipo === 'movimentacoes') {
        const { data } = await api.get('/movimentacoes', { params: { limit: 500 } })
        const items = (data.data || []).filter(m => inPeriod(m.data_movimentacao || m.criado_em))
        setRows(items.map(m => ({
          Data: formatDateTime(m.data_movimentacao || m.criado_em),
          Tipo: m.tipo,
          Produto: m.produto_nome || '-',
          Lote: m.numero_lote || m.codigo_lote || m.id_lote,
          Quantidade: m.quantidade,
          Operador: m.usuario_nome || '-',
          Localização: localizacao(m),
        })))
      }

      if (tipo === 'produtos_movimentados') {
        const { data } = await api.get('/movimentacoes', { params: { limit: 500 } })
        const grouped = new Map()
        ;(data.data || []).filter(m => inPeriod(m.data_movimentacao || m.criado_em)).forEach(m => {
          const key = m.produto_nome || 'Produto sem nome'
          const current = grouped.get(key) || { Produto: key, Categoria: m.categoria || '-', 'Total Entradas': 0, 'Total Saídas': 0, Saldo: 0 }
          if (m.tipo === 'entrada') current['Total Entradas'] += Number(m.quantidade || 0)
          if (m.tipo === 'saida') current['Total Saídas'] += Number(m.quantidade || 0)
          current.Saldo = current['Total Entradas'] - current['Total Saídas']
          grouped.set(key, current)
        })
        setRows(Array.from(grouped.values()).sort((a, b) => (b['Total Entradas'] + b['Total Saídas']) - (a['Total Entradas'] + a['Total Saídas'])))
      }

      if (tipo === 'lotes_status') {
        const { data } = await api.get('/lotes', { params: { limit: 500 } })
        setRows((data.data || []).map(l => ({
          'Nº Lote': l.numero_lote || l.codigo || l.id,
          Produto: l.produto_nome || '-',
          Validade: formatDate(l.data_validade),
          'Dias Restantes': l.dias_para_vencer ?? '-',
          Quantidade: l.quantidade,
          Status: l.status_lote || l.status || '-',
        })))
      }

      if (tipo === 'inventario') {
        const { data } = await api.get('/inventarios', { params: { limit: 500 } })
        setRows((data.data || []).filter(i => inPeriod(i.inicio || i.criado_em)).map(i => ({
          Data: formatDateTime(i.inicio || i.criado_em),
          Corredor: i.corredor || '-',
          Posições: i.total || i.total_posicoes || 0,
          Conferidas: i.conferidos || i.total_conferidas || 0,
          Divergências: i.divergencias || 0,
          Acuracidade: `${Number(i.acuracidade || 0).toFixed(1)}%`,
          Operador: i.usuario_nome || '-',
        })))
      }

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
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${tipo}-relatorio-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

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
          <button className="btn btn-outline btn-sm" onClick={exportCSV}><Download size={14} /> Exportar</button>
          <button className="btn btn-primary" onClick={gerarRelatorio} disabled={loading}>
            {loading ? <><RefreshCw size={14} className="spin" /> Gerando...</> : <><FileText size={14} /> Gerar relatório</>}
          </button>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 18 }}>
        <div style={{ padding: 20, display: 'grid', gridTemplateColumns: 'minmax(260px, 1fr) 160px 160px', gap: 14, alignItems: 'end' }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Tipo de relatório</label>
            <select className="select" value={tipo} onChange={e => { setTipo(e.target.value); setRows([]); setGeneratedAt(null) }}>
              {Object.entries(REPORTS).map(([key, cfg]) => <option key={key} value={key}>{cfg.titulo}</option>)}
            </select>
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Início</label>
            <input className="input" type="date" value={inicio} onChange={e => setInicio(e.target.value)} />
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Fim</label>
            <input className="input" type="date" value={fim} onChange={e => setFim(e.target.value)} />
          </div>
        </div>
        <div style={{ borderTop: '1px solid var(--color-border-muted)', padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 38, height: 38, borderRadius: 8, background: 'var(--color-brand-50)', color: 'var(--color-brand-600)', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
            <ReportIcon size={18} />
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 14 }}>{report.titulo}</div>
            <div style={{ color: 'var(--color-text-secondary)', fontSize: 12, marginTop: 2 }}>{report.descricao}</div>
          </div>
        </div>
      </div>

      {generatedAt && (
        <div className="summary-grid" style={{ gridTemplateColumns: '1fr', marginBottom: 18 }}>
          <div className="summary-card">
            <div className="label">Resumo</div>
            <div style={{ fontSize: 14, color: 'var(--color-text-secondary)' }}>
              <strong>{rows.length}</strong> registros encontrados · Período: {formatDate(inicio)} a {formatDate(fim)} · Gerado às {generatedAt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
            </div>
          </div>
        </div>
      )}

      <div className="table-wrap">
        <table>
          <thead>
            <tr>{report.colunas.map(col => <th key={col}>{col}</th>)}</tr>
          </thead>
          {loading ? <SkeletonTable cols={report.colunas.length} /> : (
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={report.colunas.length}>
                    <div className="empty-state">
                      <div className="empty-icon"><FileText size={24} /></div>
                      <div className="empty-title">Nenhum relatório gerado</div>
                      <div className="empty-sub">Selecione o tipo e clique em Gerar relatório.</div>
                    </div>
                  </td>
                </tr>
              ) : rows.map((row, index) => (
                <tr key={index}>
                  {report.colunas.map(col => (
                    <td key={col} style={{ fontSize: 12, fontFamily: ['Data', 'Nº Lote', 'Lote'].includes(col) ? '"IBM Plex Mono",monospace' : undefined }}>
                      {row[col] ?? '-'}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          )}
        </table>
      </div>

      <style>{`@keyframes shimmer{0%,100%{opacity:1}50%{opacity:0.5}} .spin{animation:spin 0.75s linear infinite}@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </Layout>
  )
}
