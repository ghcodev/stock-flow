import { useEffect, useState } from 'react'
import { AlertTriangle, CheckCircle, MapPin } from 'lucide-react'
import api from '../api/axios.js'
import { codigoLocalizacao } from '../constants/armazenagem.js'

const QUANTIDADE_VALIDA = /^\d{1,9}(?:\.\d{1,3})?$/
const ESPERA_MS = 400

export default function PosicaoSugerida({ idProduto, quantidade, dataValidade, ignorarLocalizacao, selecionada, onUsar }) {
  const [estado, setEstado] = useState({ status: 'ocioso' })
  const quantidadeTexto = String(quantidade ?? '').trim()
  const pronto = Boolean(idProduto) && QUANTIDADE_VALIDA.test(quantidadeTexto) && Number(quantidadeTexto) > 0

  useEffect(() => {
    if (!pronto) {
      setEstado({ status: 'ocioso' })
      return undefined
    }
    const controle = new AbortController()
    const timer = setTimeout(async () => {
      setEstado({ status: 'carregando' })
      try {
        const { data } = await api.get('/localizacoes/sugestao', {
          signal: controle.signal,
          params: {
            id_produto: idProduto,
            quantidade: quantidadeTexto,
            ...(dataValidade ? { data_validade: dataValidade } : {}),
            ...(ignorarLocalizacao ? { ignorar_localizacao: ignorarLocalizacao } : {}),
          },
        })
        setEstado({ status: 'pronto', sugestoes: data.sugestoes || [], motivoVazio: data.motivo_vazio })
      } catch (err) {
        if (controle.signal.aborted) return
        setEstado({ status: 'erro', mensagem: err.response?.data?.error || 'Não foi possível calcular a sugestão. Escolha a posição manualmente.' })
      }
    }, ESPERA_MS)
    return () => {
      clearTimeout(timer)
      controle.abort()
    }
  }, [pronto, idProduto, quantidadeTexto, dataValidade, ignorarLocalizacao])

  if (estado.status === 'ocioso') return null

  return (
    <section className="posicao-sugerida" aria-live="polite">
      <div className="posicao-sugerida-titulo"><MapPin size={13} /> Posição sugerida</div>
      {estado.status === 'carregando' && (
        <div className="posicao-sugerida-info">Calculando as melhores posições…</div>
      )}
      {estado.status === 'erro' && (
        <div className="posicao-sugerida-info posicao-sugerida-erro"><AlertTriangle size={13} /> {estado.mensagem}</div>
      )}
      {estado.status === 'pronto' && estado.sugestoes.length === 0 && (
        <div className="posicao-sugerida-info">{estado.motivoVazio || 'Nenhuma posição atende a esta entrada.'}</div>
      )}
      {estado.status === 'pronto' && estado.sugestoes.length > 0 && (
        <ul className="posicao-sugerida-lista">
          {estado.sugestoes.map(local => {
            const ativa = String(selecionada) === String(local.id)
            return (
              <li key={local.id} className={`posicao-sugerida-item${ativa ? ' ativa' : ''}`}>
                <div className="posicao-sugerida-cabecalho">
                  <strong>{codigoLocalizacao(local)}</strong>
                  <span className="badge badge-info">{Math.round(local.pontuacao)}/100</span>
                  <button type="button" className="btn btn-outline btn-sm" onClick={() => onUsar(local.id)} disabled={ativa}>
                    {ativa ? <><CheckCircle size={13} /> Selecionada</> : 'Usar esta posição'}
                  </button>
                </div>
                <ul className="posicao-sugerida-motivos">
                  {local.motivos.map(motivo => <li key={motivo}>{motivo}</li>)}
                </ul>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
