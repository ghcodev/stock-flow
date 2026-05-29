import { useMemo, useRef, useState } from 'react'
import Layout from '../components/Layout.jsx'
import { useToast } from '../context/ToastContext.jsx'
import api from '../api/axios.js'
import { Database, Download, Upload, Link2, FileJson, CheckCircle, AlertTriangle } from 'lucide-react'

const TEMPLATE = [
  {
    MATNR: '000000000000000001',
    MAKTX: 'Pão Francês Congelado',
    MATKL: 'PAES',
    MEINS: 'UN',
    MINBE: '500',
  },
]

const MOCK_HISTORY = [
  { data: '2026-05-28 14:32', fonte: 'API SAP PRD', importados: 8, atualizados: 12, erros: 0, usuario: 'Carlos Eduardo Matos' },
  { data: '2026-05-24 09:10', fonte: 'materiais-maio.json', importados: 3, atualizados: 7, erros: 1, usuario: 'Fernanda Lima Souza' },
  { data: '2026-05-18 16:45', fonte: 'API SAP HML', importados: 11, atualizados: 0, erros: 0, usuario: 'Carlos Eduardo Matos' },
]

function prettySize(size) {
  if (!size) return '0 KB'
  if (size < 1024) return `${size} B`
  return `${(size / 1024).toFixed(1)} KB`
}

function ResultCard({ result }) {
  if (!result) return null
  return (
    <div className="summary-grid" style={{ gridTemplateColumns: 'repeat(3,1fr)', marginTop: 16 }}>
      <div className="summary-card"><div className="label">Importados</div><div className="value">{result.importados}</div></div>
      <div className="summary-card"><div className="label">Atualizados</div><div className="value">{result.atualizados}</div></div>
      <div className="summary-card"><div className="label">Erros</div><div className="value" style={{ color: result.erros ? 'var(--color-danger-600)' : undefined }}>{result.erros}</div></div>
    </div>
  )
}

export default function IntegracaoSAP() {
  const toast = useToast()
  const inputRef = useRef(null)
  const [sapUrl, setSapUrl] = useState('')
  const [token, setToken] = useState('')
  const [tipo, setTipo] = useState('produtos')
  const [loadingApi, setLoadingApi] = useState(false)
  const [loadingFile, setLoadingFile] = useState(false)
  const [file, setFile] = useState(null)
  const [records, setRecords] = useState([])
  const [result, setResult] = useState(null)

  const preview = useMemo(() => file ? { name: file.name, size: prettySize(file.size), count: records.length } : null, [file, records])

  async function importFromApi() {
    if (!sapUrl || tipo !== 'produtos') return
    setLoadingApi(true)
    setResult(null)
    try {
      const response = await fetch(sapUrl, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
      if (!response.ok) throw new Error(`SAP respondeu ${response.status}`)
      const data = await response.json()
      const payload = Array.isArray(data) ? data : (data.produtos || data.data || [])
      const { data: imported } = await api.post('/sap/importar-produtos', payload)
      setResult(imported)
      toast.success('Importação SAP concluída.')
    } catch (err) {
      toast.error(err.message || 'Erro ao conectar com SAP.')
    } finally {
      setLoadingApi(false)
    }
  }

  async function readFile(selected) {
    if (!selected) return
    setFile(selected)
    setResult(null)
    try {
      const text = await selected.text()
      if (selected.name.toLowerCase().endsWith('.json')) {
        const parsed = JSON.parse(text)
        setRecords(Array.isArray(parsed) ? parsed : (parsed.produtos || parsed.data || []))
      } else {
        const [header, ...lines] = text.split(/\r?\n/).filter(Boolean)
        const cols = header.split(',').map(c => c.trim())
        setRecords(lines.map(line => {
          const values = line.split(',').map(v => v.trim())
          return Object.fromEntries(cols.map((col, i) => [col, values[i]]))
        }))
      }
    } catch {
      toast.error('Arquivo inválido.')
      setRecords([])
    }
  }

  async function importFile() {
    if (!records.length) return
    setLoadingFile(true)
    setResult(null)
    try {
      const { data } = await api.post('/sap/importar-json', records)
      setResult(data)
      toast.success('Arquivo importado com sucesso.')
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erro ao importar arquivo.')
    } finally {
      setLoadingFile(false)
    }
  }

  function downloadTemplate() {
    const blob = new Blob([JSON.stringify(TEMPLATE, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'template-sap-produtos.json'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <Layout breadcrumb={['Administração', 'Integração SAP']}>
      <div className="page-header">
        <div className="page-header-left">
          <h1>Integração SAP</h1>
          <div className="subtitle"><span className="badge badge-admin">Somente Administrador</span></div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18, marginBottom: 18 }}>
        <div className="card">
          <div className="card-header"><span className="card-title"><Link2 size={16} /> Importar via API SAP</span></div>
          <div style={{ padding: 20 }}>
            <div className="form-group">
              <label className="form-label">URL da API SAP *</label>
              <input className="input" placeholder="https://sap.empresa.com/api/materiais" value={sapUrl} onChange={e => setSapUrl(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Token/Chave SAP</label>
              <input className="input" type="password" value={token} onChange={e => setToken(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Tipo de dado</label>
              <select className="select" value={tipo} onChange={e => setTipo(e.target.value)}>
                <option value="produtos">Produtos</option>
                <option value="lotes">Lotes</option>
                <option value="movimentacoes">Movimentações</option>
              </select>
            </div>
            <button className="btn btn-primary" onClick={importFromApi} disabled={!sapUrl || tipo !== 'produtos' || loadingApi}>
              <Database size={14} /> {loadingApi ? 'Importando...' : 'Conectar e Importar'}
            </button>
            {tipo !== 'produtos' && <div style={{ marginTop: 10, color: 'var(--color-warning-700)', fontSize: 12 }}>Neste momento a importação SAP está habilitada para produtos.</div>}
          </div>
        </div>

        <div className="card">
          <div className="card-header"><span className="card-title"><Upload size={16} /> Importar via arquivo JSON</span></div>
          <div style={{ padding: 20 }}>
            <input ref={inputRef} type="file" accept=".json,.csv" hidden onChange={e => readFile(e.target.files?.[0])} />
            <div
              onDragOver={e => e.preventDefault()}
              onDrop={e => { e.preventDefault(); readFile(e.dataTransfer.files?.[0]) }}
              onClick={() => inputRef.current?.click()}
              style={{ height: 120, border: '1px dashed var(--color-border-strong)', borderRadius: 12, display: 'grid', placeItems: 'center', textAlign: 'center', cursor: 'pointer', color: 'var(--color-text-secondary)', marginBottom: 14 }}
            >
              <div>
                <FileJson size={24} />
                <div style={{ fontWeight: 700, marginTop: 6 }}>Arraste o arquivo JSON exportado do SAP aqui</div>
                <div style={{ fontSize: 12 }}>ou clique para selecionar</div>
              </div>
            </div>
            {preview && (
              <div style={{ padding: 12, border: '1px solid var(--color-border-muted)', borderRadius: 8, fontSize: 12, marginBottom: 14 }}>
                <strong>{preview.name}</strong> · {preview.size} · {preview.count} registros detectados
              </div>
            )}
            <button className="btn btn-primary" disabled={!records.length || loadingFile} onClick={importFile}>
              <CheckCircle size={14} /> {loadingFile ? 'Importando...' : 'Importar Arquivo'}
            </button>
          </div>
        </div>
      </div>

      <ResultCard result={result} />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18, marginTop: 18 }}>
        <div className="card">
          <div className="card-header"><span className="card-title">Formato esperado</span><button className="btn btn-outline btn-sm" onClick={downloadTemplate}><Download size={12} /> Baixar template JSON</button></div>
          <pre style={{ margin: 0, padding: 20, overflowX: 'auto', fontSize: 12, background: 'var(--color-bg-subtle)' }}>{JSON.stringify(TEMPLATE, null, 2)}</pre>
        </div>
        <div className="card">
          <div className="card-header"><span className="card-title">Histórico de importações</span></div>
          <table>
            <thead><tr><th>Data</th><th>Fonte</th><th>Importados</th><th>Atualizados</th><th>Erros</th><th>Usuário</th></tr></thead>
            <tbody>{MOCK_HISTORY.map((row, i) => <tr key={i}><td>{row.data}</td><td>{row.fonte}</td><td>{row.importados}</td><td>{row.atualizados}</td><td>{row.erros ? <span style={{ color: 'var(--color-danger-600)' }}>{row.erros}</span> : row.erros}</td><td>{row.usuario}</td></tr>)}</tbody>
          </table>
        </div>
      </div>
    </Layout>
  )
}
