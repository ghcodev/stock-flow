import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import Layout from '../components/Layout.jsx'
import { useToast } from '../context/ToastContext.jsx'
import api from '../api/axios.js'
import { Search, ScanLine, ArrowDownLeft, ArrowUpRight, Shuffle, MapPin, Activity } from 'lucide-react'

const TIPO_CFG = {
  entrada:      { icon: ArrowDownLeft, color: 'var(--color-success-600)', bg: 'var(--color-success-100)' },
  saida:        { icon: ArrowUpRight,  color: 'var(--color-danger-600)',  bg: 'var(--color-danger-100)'  },
  transferencia:{ icon: Shuffle,       color: 'var(--color-brand-600)',   bg: 'var(--color-brand-100)'   },
  ajuste:       { icon: Activity,      color: 'var(--color-admin-600)',   bg: 'var(--color-admin-100)'   },
}

export default function Rastreabilidade() {
  const toast = useToast()
  const [searchParams] = useSearchParams()
  const buscaParam = searchParams.get('busca') || ''
  const ultimaBuscaUrlRef = useRef('')
  const [query, setQuery] = useState('')
  const [lote, setLote] = useState(null)
  const [timeline, setTimeline] = useState([])
  const [loading, setLoading] = useState(false)

  async function buscarTermo(termo) {
    const busca = termo.trim()
    if (!busca) return
    setLoading(true)
    setLote(null)
    setTimeline([])
    try {
      const { data: lotesData } = await api.get('/lotes', { params: { search: busca, limit: 1 } })
      const items = lotesData.data || []
      if (items.length === 0) {
        toast.warning('Nenhum lote encontrado para esse termo de busca.')
        setLoading(false)
        return
      }
      const found = items[0]
      setLote(found)
      const { data: tl } = await api.get(`/lotes/${found.id}/timeline`)
      setTimeline(tl || [])
    } catch {
      toast.error('Erro ao rastrear lote.')
    } finally {
      setLoading(false)
    }
  }

  function handleSearch(e) {
    e.preventDefault()
    buscarTermo(query)
  }

  useEffect(() => {
    const termo = buscaParam.trim()
    if (!termo || ultimaBuscaUrlRef.current === termo) return

    ultimaBuscaUrlRef.current = termo
    setQuery(termo)
    buscarTermo(termo)
  }, [buscaParam])

  function fmtLoc(e) {
    if (e.corredor) return `${e.corredor}-N${e.nivel}-P${e.posicao}`
    return e.localizacao || '—'
  }

  function statusCls(s) {
    const m = { ativo: 'badge-success', vencendo: 'badge-warning', vencido: 'badge-danger', bloqueado: 'badge-neutral' }
    return m[s?.toLowerCase()] || 'badge-neutral'
  }

  return (
    <Layout breadcrumb={['Análise', 'Rastreabilidade']}>
      <div className="page-header">
        <div className="page-header-left">
          <h1>Rastreabilidade</h1>
          <div className="subtitle">
            <span>Rastreio completo por lote, RFID ou produto</span>
            <span className="sep" />
            <span>Log imutável · 7 anos</span>
          </div>
        </div>
        <div className="page-header-actions">
          <button className="btn btn-outline btn-sm"><ScanLine size={14} /> Escanear RFID</button>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 24 }}>
        <div style={{ padding: 24 }}>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 14 }}>Buscar lote ou produto</div>
          <form onSubmit={handleSearch} style={{ display: 'flex', gap: 12 }}>
            <div style={{ flex: 1, position: 'relative' }}>
              <Search size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-tertiary)' }} />
              <input
                className="input"
                style={{ paddingLeft: 36, height: 40, fontSize: 14 }}
                placeholder="Código do lote, RFID ou nome do produto"
                value={query}
                onChange={e => setQuery(e.target.value)}
              />
            </div>
            <button type="submit" className="btn btn-primary" style={{ height: 40 }} disabled={loading}>
              {loading ? 'Buscando…' : 'Rastrear'}
            </button>
          </form>
        </div>
      </div>

      {lote && (
        <>
          <div className="card" style={{ marginBottom: 20 }}>
            <div style={{ padding: 20 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
                <div>
                  <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-0.02em', marginBottom: 4 }}>{lote.produto_nome || '—'}</div>
                  <div style={{ display: 'flex', gap: 16, fontSize: 12, color: 'var(--color-text-secondary)', flexWrap: 'wrap' }}>
                    <span style={{ fontFamily: '"IBM Plex Mono",monospace', color: 'var(--color-brand-700)', fontWeight: 600 }}>{lote.codigo || lote.id}</span>
                    {lote.rfid && <span style={{ fontFamily: '"IBM Plex Mono",monospace', fontSize: 11 }}>RFID: {lote.rfid}</span>}
                  </div>
                </div>
                <span className={`badge ${statusCls(lote.status)}`}>{lote.status || '—'}</span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 16, marginTop: 20, paddingTop: 20, borderTop: '1px solid var(--color-border-default)' }}>
                {[
                  { l: 'Fabricação', v: lote.data_fabricacao ? new Date(lote.data_fabricacao).toLocaleDateString('pt-BR') : '—' },
                  { l: 'Validade',   v: lote.data_validade   ? new Date(lote.data_validade).toLocaleDateString('pt-BR')   : '—', warn: lote.dias_para_vencer != null && lote.dias_para_vencer < 30 },
                  { l: 'Saldo atual', v: `${lote.quantidade ?? '—'} un.` },
                  { l: 'Localização', v: lote.corredor ? `${lote.corredor}-N${lote.nivel}-P${lote.posicao}` : '—' },
                  { l: 'Movimentações', v: timeline.length },
                ].map(f => (
                  <div key={f.l}>
                    <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-text-tertiary)', marginBottom: 4 }}>{f.l}</div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: f.warn ? 'var(--color-warning-700)' : 'var(--color-text-primary)' }}>{f.v}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <span className="card-title">Linha do tempo — rastreio completo</span>
            </div>
            <div style={{ padding: '8px 24px 24px' }}>
              {timeline.length === 0 ? (
                <div style={{ padding: '32px 0', textAlign: 'center', color: 'var(--color-text-tertiary)', fontSize: 13 }}>Nenhuma movimentação registrada.</div>
              ) : timeline.map((e, i) => {
                const cfg = TIPO_CFG[e.tipo] || { icon: Activity, color: 'var(--color-text-secondary)', bg: 'var(--color-bg-muted)' }
                const isEntrada = e.tipo === 'entrada'
                const isSaida = e.tipo === 'saida'
                return (
                  <div key={e.id || i} style={{ display: 'flex', gap: 16, paddingTop: 16 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
                      <div style={{ width: 36, height: 36, borderRadius: '50%', background: cfg.bg, display: 'grid', placeItems: 'center', color: cfg.color }}>
                        <cfg.icon size={16} />
                      </div>
                      {i < timeline.length - 1 && <div style={{ width: 1, flex: 1, background: 'var(--color-border-default)', margin: '6px 0' }} />}
                    </div>
                    <div style={{ flex: 1, paddingBottom: 16 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div style={{ fontWeight: 600, fontSize: 13 }}>{e.descricao || e.motivo || e.tipo}</div>
                        <span style={{ fontWeight: 700, color: isEntrada ? 'var(--color-success-600)' : isSaida ? 'var(--color-danger-600)' : 'var(--color-text-secondary)' }}>
                          {isEntrada ? '+' : isSaida ? '-' : '↔'}{e.quantidade} un.
                        </span>
                      </div>
                      <div style={{ display: 'flex', gap: 12, fontSize: 12, color: 'var(--color-text-tertiary)', marginTop: 4 }}>
                        <span style={{ fontFamily: '"IBM Plex Mono",monospace' }}>
                          {e.criado_em ? new Date(e.criado_em).toLocaleString('pt-BR') : '—'}
                        </span>
                        {(e.corredor || e.origem_corredor) && <>
                          <span>·</span>
                          <span><MapPin size={11} style={{ verticalAlign: -1 }} /> {fmtLoc(e)}</span>
                        </>}
                        {e.usuario_nome && <><span>·</span><span>{e.usuario_nome}</span></>}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </>
      )}
    </Layout>
  )
}
