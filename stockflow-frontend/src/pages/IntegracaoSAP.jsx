import { useMemo, useRef, useState } from 'react'
import Layout from '../components/Layout.jsx'
import { useToast } from '../context/ToastContext.jsx'
import api from '../api/axios.js'
import {
  Database, Download, Upload, Link2, FileJson, CheckCircle,
  WifiOff, Loader, AlertCircle, Eye, EyeOff, FileCode, History, X, Clock,
} from 'lucide-react'

/* ─── Constants ────────────────────────────────────────────── */
const TEMPLATE = [
  { MATNR: '000000000000000001', MAKTX: 'Pão Francês Congelado', MATKL: 'PAES', MEINS: 'UN', MINBE: '500' },
]

const MOCK_HISTORY = [
  { data: '2026-05-28 14:32', fonte: 'API SAP PRD',          importados: 8,  atualizados: 12, erros: 0, usuario: 'Carlos Eduardo Matos' },
  { data: '2026-05-24 09:10', fonte: 'materiais-maio.json',  importados: 3,  atualizados: 7,  erros: 1, usuario: 'Fernanda Lima Souza' },
  { data: '2026-05-18 16:45', fonte: 'API SAP HML',          importados: 11, atualizados: 0,  erros: 0, usuario: 'Carlos Eduardo Matos' },
]

const TIPO_DESC = {
  produtos:      'Importa o catálogo de materiais do SAP MM',
  lotes:         'Importa lotes e números de série do SAP WM',
  movimentacoes: 'Importa estrutura de armazém do SAP EWM',
}

/* ─── Pure helpers ─────────────────────────────────────────── */
function prettySize(size) {
  if (!size) return '0 KB'
  if (size < 1024) return `${size} B`
  return `${(size / 1024).toFixed(1)} KB`
}

function getHistStatus(row) {
  if (row.erros > 0 && row.importados === 0 && row.atualizados === 0) return { label: 'Erro',    cls: 'badge-danger'  }
  if (row.erros > 0) return { label: 'Parcial', cls: 'badge-warning' }
  return                    { label: 'Sucesso', cls: 'badge-success'  }
}

/* ─── Sub-components ───────────────────────────────────────── */
function SapKpiCard({ icon: Icon, label, badge, value, valueStyle }) {
  return (
    <div className="sap-kpi-card">
      <div className="sap-kpi-icon"><Icon size={16} /></div>
      <div style={{ minWidth: 0 }}>
        <div className="sap-kpi-label">{label}</div>
        {badge
          ? <div style={{ marginTop: 4 }}>{badge}</div>
          : <div className="sap-kpi-value" style={valueStyle}>{value}</div>
        }
      </div>
    </div>
  )
}

function ResultCard({ result }) {
  if (!result) return null
  return (
    <div className="summary-grid" style={{ gridTemplateColumns: 'repeat(3,1fr)', marginBottom: 18 }}>
      <div className="summary-card"><div className="label">Importados</div><div className="value">{result.importados}</div></div>
      <div className="summary-card"><div className="label">Atualizados</div><div className="value">{result.atualizados}</div></div>
      <div className="summary-card">
        <div className="label">Erros</div>
        <div className="value" style={{ color: result.erros ? 'var(--color-danger-600)' : undefined }}>{result.erros}</div>
      </div>
    </div>
  )
}

/* ─── Main component ───────────────────────────────────────── */
export default function IntegracaoSAP() {
  const toast    = useToast()
  const inputRef = useRef(null)

  const [sapUrl,           setSapUrl]           = useState('')
  const [token,            setToken]            = useState('')
  const [tipo,             setTipo]             = useState('produtos')
  const [loadingApi,       setLoadingApi]       = useState(false)
  const [loadingFile,      setLoadingFile]      = useState(false)
  const [file,             setFile]             = useState(null)
  const [records,          setRecords]          = useState([])
  const [result,           setResult]           = useState(null)
  const [showToken,        setShowToken]        = useState(false)
  const [isDragOver,       setIsDragOver]       = useState(false)
  const [connectionStatus, setConnectionStatus] = useState('disconnected')
  const [registrosImport,  setRegistrosImport]  = useState(0)
  const [errosSessao,      setErrosSessao]      = useState(0)
  const [ultimaImport,     setUltimaImport]     = useState(null)
  const [lastCount,        setLastCount]        = useState(0)

  const preview     = useMemo(() => file ? { name: file.name, size: prettySize(file.size), count: records.length } : null, [file, records])
  const isUrlInvalid = sapUrl.trim() !== '' && !sapUrl.trim().startsWith('http')
  const isConnecting = loadingApi || loadingFile

  /* ── API (logic unchanged) ──────────────────────────────── */
  async function importFromApi() {
    if (!sapUrl || tipo !== 'produtos') return
    setLoadingApi(true)
    setConnectionStatus('connecting')
    setResult(null)
    try {
      const response = await fetch(sapUrl, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
      if (!response.ok) throw new Error(`SAP respondeu ${response.status}`)
      const data = await response.json()
      const payload = Array.isArray(data) ? data : (data.produtos || data.data || [])
      const { data: imported } = await api.post('/sap/importar-produtos', payload)
      setResult(imported)
      const count = imported?.importados || 0
      setLastCount(count)
      setRegistrosImport(prev => prev + count)
      setUltimaImport(new Date())
      setConnectionStatus('success')
      toast.success('Importação SAP concluída.')
      setTimeout(() => setConnectionStatus('disconnected'), 10000)
    } catch (err) {
      setConnectionStatus('error')
      setErrosSessao(prev => prev + 1)
      toast.error(err.message || 'Erro ao conectar com SAP.')
    } finally {
      setLoadingApi(false)
    }
  }

  async function readFile(selected) {
    if (!selected) return
    if (!selected.name.toLowerCase().endsWith('.json')) {
      toast.error('Apenas arquivos .json são aceitos')
      return
    }
    setFile(selected)
    setResult(null)
    try {
      const text = await selected.text()
      const parsed = JSON.parse(text)
      setRecords(Array.isArray(parsed) ? parsed : (parsed.produtos || parsed.data || []))
    } catch {
      toast.error('Arquivo inválido ou JSON malformado.')
      setRecords([])
    }
  }

  async function importFile() {
    if (!records.length) return
    setLoadingFile(true)
    setConnectionStatus('connecting')
    setResult(null)
    try {
      const { data } = await api.post('/sap/importar-json', records)
      setResult(data)
      const count = data?.importados || 0
      setLastCount(count)
      setRegistrosImport(prev => prev + count)
      setUltimaImport(new Date())
      setConnectionStatus('success')
      toast.success('Arquivo importado com sucesso.')
      setTimeout(() => setConnectionStatus('disconnected'), 10000)
    } catch (err) {
      setConnectionStatus('error')
      setErrosSessao(prev => prev + 1)
      toast.error(err.response?.data?.error || 'Erro ao importar arquivo.')
    } finally {
      setLoadingFile(false)
    }
  }

  function downloadTemplate() {
    const blob = new Blob([JSON.stringify(TEMPLATE, null, 2)], { type: 'application/json' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = 'template-sap-produtos.json'
    a.click()
    URL.revokeObjectURL(url)
  }

  /* ── Banner config ──────────────────────────────────────── */
  const bannerCfg = {
    disconnected: { icon: WifiOff,      text: 'Nenhuma conexão ativa com o SAP. Configure a URL e o token para iniciar.', bg: 'var(--color-bg-muted)',     border: 'var(--color-border-default)',  color: 'var(--color-text-secondary)', spin: false },
    connecting:   { icon: Loader,       text: 'Conectando ao SAP e importando dados...', bg: 'var(--color-brand-50)',    border: 'var(--color-brand-300)',       color: 'var(--color-brand-700)',      spin: true  },
    success:      { icon: CheckCircle,  text: `Importação concluída. ${lastCount} registros importados com sucesso.`,     bg: 'var(--color-success-50)',  border: 'var(--color-success-200)',     color: 'var(--color-success-700)',    spin: false },
    error:        { icon: AlertCircle,  text: 'Falha na conexão. Verifique a URL e o token SAP.',                        bg: 'var(--color-danger-50)',   border: 'var(--color-danger-200)',      color: 'var(--color-danger-700)',     spin: false },
  }
  const banner = bannerCfg[connectionStatus] || bannerCfg.disconnected
  const BannerIcon = banner.icon

  /* ── Render ──────────────────────────────────────────────── */
  return (
    <Layout breadcrumb={['Administração', 'Integração SAP']}>
      <div className="page-header">
        <div className="page-header-left">
          <h1>Integração SAP</h1>
          <div className="subtitle"><span className="badge badge-admin">Somente Administrador</span></div>
        </div>
      </div>

      {/* KPI Strip */}
      <div className="sap-kpi-grid">
        <SapKpiCard
          icon={Database}
          label="Status da Conexão"
          badge={
            <span className={`badge ${connectionStatus === 'success' ? 'badge-success' : connectionStatus === 'error' ? 'badge-danger' : connectionStatus === 'connecting' ? 'badge-info' : 'badge-neutral'}`}>
              {connectionStatus === 'success' ? 'Conectado' : connectionStatus === 'error' ? 'Erro' : connectionStatus === 'connecting' ? 'Conectando…' : 'Desconectado'}
            </span>
          }
        />
        <SapKpiCard
          icon={Clock}
          label="Última Importação"
          value={ultimaImport ? ultimaImport.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '—'}
          valueStyle={{ fontSize: ultimaImport ? 20 : 26 }}
        />
        <SapKpiCard icon={CheckCircle} label="Registros Importados" value={registrosImport} />
        <SapKpiCard icon={AlertCircle} label="Erros na Sessão"      value={errosSessao} />
      </div>

      {/* Connection status banner */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', background: banner.bg, border: `1px solid ${banner.border}`, borderRadius: 'var(--radius-md)', marginBottom: 18, fontSize: 13, color: banner.color }}>
        <BannerIcon size={16} style={{ flexShrink: 0, animation: banner.spin ? 'sap-spin 1s linear infinite' : undefined }} />
        <span>{banner.text}</span>
      </div>

      {/* Two-column import grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18, marginBottom: 18 }}>

        {/* Left — API import */}
        <div className="card">
          <div className="card-header"><span className="card-title"><Link2 size={16} /> Importar via API SAP</span></div>
          <div style={{ padding: 20 }}>

            <div className="form-group">
              <label className="form-label">
                URL da API SAP
                <span className="badge badge-danger" style={{ fontSize: 9, padding: '1px 5px', marginLeft: 6 }}>Obrigatório</span>
              </label>
              <div className="input-prefix">
                <Link2 size={14} />
                <input
                  className={`input ${isUrlInvalid ? 'invalid' : ''}`}
                  style={{ paddingLeft: 34 }}
                  placeholder="https://sap.empresa.com/api/materiais"
                  value={sapUrl}
                  onChange={e => setSapUrl(e.target.value)}
                />
              </div>
              {isUrlInvalid && <div className="form-error"><AlertCircle size={13} /> URL deve começar com https://</div>}
            </div>

            <div className="form-group">
              <label className="form-label">Token/Chave SAP</label>
              <div style={{ position: 'relative' }}>
                <input
                  className="input"
                  type={showToken ? 'text' : 'password'}
                  placeholder="Bearer token ou chave de API"
                  value={token}
                  onChange={e => setToken(e.target.value)}
                  style={{ paddingRight: 36 }}
                />
                <button
                  type="button"
                  aria-label={showToken ? 'Ocultar token' : 'Mostrar token'}
                  onClick={() => setShowToken(prev => !prev)}
                  style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-tertiary)', display: 'grid', placeItems: 'center', width: 20, height: 20 }}
                >
                  {showToken ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Tipo de dado</label>
              <select className="select" value={tipo} onChange={e => setTipo(e.target.value)}>
                <option value="produtos">Produtos</option>
                <option value="lotes">Lotes</option>
                <option value="movimentacoes">Localizações</option>
              </select>
              <div style={{ marginTop: 6, fontSize: 12, color: 'var(--color-text-tertiary)' }}>{TIPO_DESC[tipo]}</div>
            </div>

            <button
              type="button"
              className="btn btn-primary"
              onClick={importFromApi}
              disabled={!sapUrl || isUrlInvalid || tipo !== 'produtos' || isConnecting}
            >
              {loadingApi
                ? <><Loader size={14} style={{ animation: 'sap-spin 1s linear infinite' }} /> Importando…</>
                : <><Database size={14} /> Conectar e Importar</>
              }
            </button>

            {tipo !== 'produtos' && (
              <div style={{ marginTop: 10, color: 'var(--color-warning-700)', fontSize: 12 }}>
                Neste momento a importação SAP via API está habilitada apenas para produtos.
              </div>
            )}
          </div>
        </div>

        {/* Right — file import */}
        <div className="card">
          <div className="card-header"><span className="card-title"><Upload size={16} /> Importar via arquivo JSON</span></div>
          <div style={{ padding: 20 }}>
            <input ref={inputRef} type="file" accept=".json" hidden onChange={e => readFile(e.target.files?.[0])} />

            {/* Drop zone */}
            <div
              onDragOver={e => { e.preventDefault(); setIsDragOver(true) }}
              onDragLeave={() => setIsDragOver(false)}
              onDrop={e => { e.preventDefault(); setIsDragOver(false); readFile(e.dataTransfer.files?.[0]) }}
              onClick={() => !file && inputRef.current?.click()}
              style={{
                minHeight: 120,
                border: `2px dashed ${isDragOver ? 'var(--color-brand-600)' : 'var(--color-border-strong)'}`,
                borderRadius: 8,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                textAlign: 'center',
                cursor: file ? 'default' : 'pointer',
                color: isDragOver ? 'var(--color-brand-600)' : 'var(--color-text-secondary)',
                background: isDragOver ? 'var(--color-brand-50)' : 'transparent',
                transition: 'border-color 100ms, background 100ms, color 100ms',
                marginBottom: 14,
                padding: 20,
              }}
            >
              {file ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%' }}>
                  <FileJson size={20} style={{ color: 'var(--color-brand-600)', flexShrink: 0 }} />
                  <div style={{ flex: 1, textAlign: 'left' }}>
                    <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--color-text-primary)' }}>{file.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--color-text-tertiary)' }}>
                      {preview?.size} · {preview?.count} registros detectados
                    </div>
                  </div>
                  <button
                    type="button"
                    aria-label="Remover arquivo"
                    onClick={e => { e.stopPropagation(); setFile(null); setRecords([]) }}
                    style={{ color: 'var(--color-text-tertiary)', display: 'grid', placeItems: 'center', width: 24, height: 24, borderRadius: 4, flexShrink: 0 }}
                  >
                    <X size={14} />
                  </button>
                </div>
              ) : (
                <>
                  <Upload size={24} style={{ marginBottom: 8, opacity: 0.6 }} />
                  <div style={{ fontWeight: 600, fontSize: 13 }}>Arraste o arquivo JSON exportado do SAP</div>
                  <div style={{ fontSize: 12, marginTop: 4 }}>ou clique para selecionar · apenas .json</div>
                </>
              )}
            </div>

            <button
              type="button"
              className="btn btn-primary"
              disabled={!records.length || isConnecting}
              onClick={importFile}
            >
              {loadingFile
                ? <><Loader size={14} style={{ animation: 'sap-spin 1s linear infinite' }} /> Importando…</>
                : <><CheckCircle size={14} /> Importar Arquivo</>
              }
            </button>
          </div>
        </div>
      </div>

      {/* Result cards */}
      <ResultCard result={result} />

      {/* Bottom grid — format + history */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18, marginTop: result ? 0 : 0 }}>

        {/* Formato esperado */}
        <div className="card">
          <div className="card-header">
            <span className="card-title"><FileCode size={16} /> Formato esperado</span>
            <button type="button" className="btn btn-outline btn-sm" onClick={downloadTemplate}>
              <Download size={12} /> Baixar template JSON
            </button>
          </div>
          <div style={{ padding: '12px 16px 16px' }}>
            <pre style={{ margin: 0, overflowX: 'auto', fontSize: 11, fontFamily: '"IBM Plex Mono",monospace', background: 'var(--color-bg-muted)', borderRadius: 6, padding: '12px 14px', color: 'var(--color-text-primary)', lineHeight: 1.6 }}>
              {JSON.stringify(TEMPLATE, null, 2)}
            </pre>
          </div>
        </div>

        {/* Histórico */}
        <div className="card">
          <div className="card-header">
            <span className="card-title"><History size={16} /> Histórico de importações</span>
          </div>
          {MOCK_HISTORY.length === 0 ? (
            <div className="empty-state" style={{ padding: '32px 0' }}>
              <div className="empty-icon empty-icon-animated"><History size={24} /></div>
              <div className="empty-title">Nenhuma importação registrada</div>
            </div>
          ) : (
            <table className="sap-hist-table">
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Fonte</th>
                  <th style={{ textAlign: 'center' }}>Import.</th>
                  <th style={{ textAlign: 'center' }}>Erros</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {MOCK_HISTORY.map((row, i) => {
                  const st = getHistStatus(row)
                  return (
                    <tr key={i} className="sap-hist-row">
                      <td style={{ fontFamily: '"IBM Plex Mono",monospace', fontSize: 11 }}>{row.data}</td>
                      <td style={{ fontSize: 12 }}>{row.fonte}</td>
                      <td style={{ textAlign: 'center', fontWeight: 700 }}>{row.importados}</td>
                      <td style={{ textAlign: 'center', color: row.erros ? 'var(--color-danger-600)' : 'var(--color-text-tertiary)', fontWeight: row.erros ? 700 : 400 }}>{row.erros}</td>
                      <td><span className={`badge ${st.cls}`}>{st.label}</span></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <style>{`
        @keyframes sap-spin { to { transform:rotate(360deg) } }

        /* KPI Strip */
        .sap-kpi-grid { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:12px; margin-bottom:16px }
        .sap-kpi-card { display:flex; align-items:center; gap:12px; min-height:74px; padding:12px 14px; background:var(--color-bg-default); border:1px solid var(--color-border-default); border-radius:var(--radius-md); box-shadow:var(--shadow-xs) }
        .sap-kpi-icon { width:30px; height:30px; display:grid; place-items:center; background:var(--color-bg-subtle); border:1px solid var(--color-border-muted); border-radius:var(--radius-sm); flex-shrink:0; color:var(--color-text-secondary) }
        .sap-kpi-label { font-size:10px; font-weight:700; color:var(--color-text-tertiary); text-transform:uppercase; letter-spacing:0.08em }
        .sap-kpi-value { margin-top:2px; font-size:26px; line-height:1; font-weight:800; color:var(--color-text-primary); font-variant-numeric:tabular-nums }

        /* History table */
        .sap-hist-table { width:100%; border-collapse:collapse }
        .sap-hist-table thead th { padding:8px 16px; text-align:left; font-size:10px; font-weight:600; text-transform:uppercase; letter-spacing:0.07em; color:var(--color-text-tertiary); background:var(--color-bg-elevated); border-bottom:1px solid var(--color-border-default); position:sticky; top:0; z-index:1 }
        .sap-hist-row { border-bottom:1px solid var(--color-border-muted); transition:background 80ms }
        .sap-hist-row:hover { background:var(--color-bg-subtle) }
        .sap-hist-row td { padding:10px 16px; font-size:13px; color:var(--color-text-primary); vertical-align:middle }

        @media(max-width:1180px) { .sap-kpi-grid{grid-template-columns:repeat(2,minmax(0,1fr))} }
        @media(max-width:700px)  { .sap-kpi-grid{grid-template-columns:1fr} }
      `}</style>
    </Layout>
  )
}

