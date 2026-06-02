import { useEffect, useRef, useState } from 'react'
import { AlertCircle, CheckCircle, Hash, Loader2, ScanLine, X } from 'lucide-react'
import api from '../api/axios.js'

const confirmLabel = {
  entrada: 'Confirmar Entrada',
  saida: 'Confirmar Saida',
  rastreabilidade: 'Rastrear Lote',
}

function formatDate(value) {
  return value ? new Date(value).toLocaleDateString('pt-BR') : 'Nao informada'
}

function validadeTone(value) {
  if (!value) return 'var(--color-text-secondary)'
  const diff = Math.floor((new Date(value) - Date.now()) / 86400000)
  if (diff < 0) return 'var(--color-danger-700)'
  if (diff <= 30) return 'var(--color-warning-700)'
  return 'var(--color-success-700)'
}

function normalizeLote(data, codigo) {
  const lote = data?.lote || data?.data || data || {}
  const corredor = lote.corredor || data?.corredor
  const nivel = lote.nivel || data?.nivel
  const posicao = lote.posicao || data?.posicao
  const localizacao = lote.localizacao || lote.localizacao_nome || (
    corredor ? `${corredor}-N${nivel}-P${posicao}` : ''
  )

  return {
    ...lote,
    id: lote.id_lote || lote.id,
    id_lote: lote.id_lote || lote.id,
    numero_lote: lote.numero_lote || lote.codigo_lote || lote.codigo || codigo,
    produto_nome: lote.produto_nome || lote.produto || 'Produto nao informado',
    quantidade: lote.quantidade,
    data_validade: lote.data_validade,
    localizacao,
    corredor,
    nivel,
    posicao,
    codigo_rfid: lote.codigo_rfid || lote.rfid || lote.codigo || codigo,
    tipo_identificacao: lote.tipo,
  }
}

export default function RFIDModal({ isOpen, onClose, onConfirm, mode = 'entrada', title = 'Leitura RFID' }) {
  const inputRef = useRef(null)
  const [codigo, setCodigo] = useState('')
  const [estado, setEstado] = useState('aguardando')
  const [loteEncontrado, setLoteEncontrado] = useState(null)

  useEffect(() => {
    if (!isOpen) return
    setCodigo('')
    setEstado('aguardando')
    setLoteEncontrado(null)
    setTimeout(() => inputRef.current?.focus(), 0)
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return undefined
    const fn = e => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', fn)
    return () => window.removeEventListener('keydown', fn)
  }, [isOpen, onClose])

  async function buscarRFID(value = codigo) {
    const clean = value.trim()
    if (!clean) return
    setEstado('buscando')
    try {
      const { data } = await api.get(`/identificacoes/${encodeURIComponent(clean)}`)
      const lote = normalizeLote(data, clean)
      if (lote.id_lote || lote.numero_lote) {
        setLoteEncontrado(lote)
        setEstado('encontrado')
      } else {
        setEstado('nao_encontrado')
      }
    } catch {
      setEstado('nao_encontrado')
    }
  }

  function handleConfirm() {
    if (!loteEncontrado) return
    onConfirm(loteEncontrado)
  }

  if (!isOpen) return null

  return (
    <div className="rfid-modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="rfid-modal" role="dialog" aria-modal="true" aria-label={title}>
        <div className="rfid-modal-header">
          <div className="rfid-modal-title">
            <ScanLine size={18} />
            <span>{title}</span>
            <strong>MANUAL</strong>
          </div>
          <button className="rfid-close" type="button" onClick={onClose} aria-label="Fechar">
            <X size={18} />
          </button>
        </div>

        <div className="rfid-modal-body">
          {estado === 'aguardando' && (
            <div className="rfid-state">
              <div className="rfid-scan-icon cell-pulse"><ScanLine size={64} /></div>
              <h3>Aproxime o tag RFID ou digite o codigo manualmente</h3>
              <div className="rfid-input-wrap">
                <Hash size={18} />
                <input
                  ref={inputRef}
                  value={codigo}
                  onChange={e => setCodigo(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') buscarRFID() }}
                  placeholder="Ex: RFID-AT-001 ou AT-PAO-2026-001"
                  autoComplete="off"
                />
              </div>
              <button className="btn btn-primary" type="button" onClick={() => buscarRFID()} disabled={!codigo.trim()}>
                Buscar
              </button>
              <p>Em ambiente de producao, a leitura e automatica via totem</p>
            </div>
          )}

          {estado === 'buscando' && (
            <div className="rfid-state">
              <Loader2 className="rfid-spinner" size={42} />
              <h3>Consultando banco de dados RFID...</h3>
            </div>
          )}

          {estado === 'encontrado' && loteEncontrado && (
            <div className="rfid-state">
              <CheckCircle size={32} style={{ color: 'var(--color-success-600)' }} />
              <div className="rfid-lote-card">
                <div className="rfid-lote-code">{loteEncontrado.numero_lote}</div>
                <div className="rfid-lote-product">{loteEncontrado.produto_nome}</div>
                <div className="rfid-lote-grid">
                  <span>Quantidade atual</span>
                  <strong>{loteEncontrado.quantidade != null ? `${loteEncontrado.quantidade} un.` : '-'}</strong>
                  <span>Validade</span>
                  <strong style={{ color: validadeTone(loteEncontrado.data_validade) }}>{formatDate(loteEncontrado.data_validade)}</strong>
                  <span>Localizacao atual</span>
                  <strong>{loteEncontrado.localizacao || '-'}</strong>
                </div>
                <span className="badge badge-success">RFID VERIFICADO</span>
              </div>
              <div className="rfid-actions">
                <button className="btn btn-primary" type="button" onClick={handleConfirm}>
                  {confirmLabel[mode] || 'Confirmar'}
                </button>
                <button className="btn btn-outline" type="button" onClick={() => { setCodigo(''); setEstado('aguardando'); setLoteEncontrado(null); setTimeout(() => inputRef.current?.focus(), 0) }}>
                  Ler outro codigo
                </button>
              </div>
            </div>
          )}

          {estado === 'nao_encontrado' && (
            <div className="rfid-state">
              <AlertCircle size={32} style={{ color: 'var(--color-danger-600)' }} />
              <h3>Codigo RFID nao encontrado</h3>
              <p>Verifique o codigo e tente novamente</p>
              <button className="btn btn-outline" type="button" onClick={() => { setEstado('aguardando'); setTimeout(() => inputRef.current?.focus(), 0) }}>
                Tentar novamente
              </button>
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes rfid-spin{to{transform:rotate(360deg)}}
        .rfid-modal-backdrop{position:fixed;inset:0;z-index:100000;display:grid;place-items:center;padding:20px;background:rgba(15,31,61,0.38);backdrop-filter:blur(2px)}
        .rfid-modal{width:min(480px,100%);overflow:hidden;background:var(--color-bg-default);border:1px solid var(--color-border-default);border-radius:8px;box-shadow:var(--shadow-lg)}
        .rfid-modal-header{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:14px 16px;background:#0f1f3d;color:white}
        .rfid-modal-title{display:flex;align-items:center;gap:10px;font-size:15px;font-weight:800}
        .rfid-modal-title strong{height:20px;display:inline-flex;align-items:center;padding:0 8px;border-radius:999px;background:rgba(255,255,255,0.15);font-size:10px;letter-spacing:0.08em}
        .rfid-close{width:30px;height:30px;display:grid;place-items:center;border-radius:6px;color:white}
        .rfid-close:hover{background:rgba(255,255,255,0.1)}
        .rfid-modal-body{padding:26px}
        .rfid-state{display:flex;flex-direction:column;align-items:center;text-align:center;gap:16px}
        .rfid-scan-icon{width:92px;height:92px;display:grid;place-items:center;border-radius:50%;color:var(--color-brand-600);background:var(--color-brand-50, rgba(46,117,182,0.08))}
        .rfid-state h3{margin:0;color:var(--color-text-primary);font-size:16px;font-weight:800}
        .rfid-state p{margin:0;color:var(--color-text-tertiary);font-size:12px}
        .rfid-input-wrap{width:100%;position:relative}
        .rfid-input-wrap svg{position:absolute;left:14px;top:50%;transform:translateY(-50%);color:var(--color-text-tertiary)}
        .rfid-input-wrap input{width:100%;height:48px;padding:0 14px 0 42px;border:1px solid var(--color-border-default);border-radius:6px;background:var(--color-bg-default);color:var(--color-text-primary);font-family:"IBM Plex Mono",monospace;font-size:13px;text-align:center}
        .rfid-input-wrap input:focus{outline:none;border-color:var(--color-brand-600)}
        .rfid-spinner{color:var(--color-brand-600);animation:rfid-spin 700ms linear infinite}
        .rfid-lote-card{width:100%;padding:16px;border:1px solid var(--color-border-default);border-radius:8px;background:var(--color-bg-subtle);text-align:left}
        .rfid-lote-code{font-family:"IBM Plex Mono",monospace;font-size:15px;font-weight:800;color:var(--color-brand-700);word-break:break-word}
        .rfid-lote-product{margin-top:4px;margin-bottom:14px;color:var(--color-text-primary);font-size:14px;font-weight:700}
        .rfid-lote-grid{display:grid;grid-template-columns:1fr 1fr;gap:9px 14px;margin-bottom:14px;font-size:12px}
        .rfid-lote-grid span{color:var(--color-text-tertiary)}
        .rfid-lote-grid strong{color:var(--color-text-primary);text-align:right}
        .rfid-actions{width:100%;display:flex;gap:10px}
        .rfid-actions .btn{flex:1;justify-content:center}
        @media(max-width:560px){.rfid-modal-body{padding:20px}.rfid-actions{flex-direction:column}.rfid-lote-grid{grid-template-columns:1fr}.rfid-lote-grid strong{text-align:left}}
      `}</style>
    </div>
  )
}
