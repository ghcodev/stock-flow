import { useRef, useState } from "react";
import { cancelarContagem, finalizarContagem } from "../../api/inventario.ts";
import { obterLote } from "../../api/lotes.ts";
import type { Contagem, ResultadoDeFinalizacao } from "../../api/tipos.ts";
import { useAutenticacao } from "../../autenticacao/ContextoDeAutenticacao.tsx";
import { AvisoDoFormulario } from "../../componentes/Campo.tsx";
import { Modal } from "../../componentes/Modal.tsx";
import { useCarregar } from "../../hooks/useCarregar.ts";
import { formatarQuantidade } from "../../util/decimal.ts";
import { criarEnvioUnico } from "../../util/envio.ts";
import { interpretarFalhaDeDecisao, preverFinalizacao, textoDaDivergencia } from "../../util/inventario.ts";

export type Decisao = { modo: "finalizar" | "cancelar"; contagem: Contagem };

type Propriedades = {
  decisao: Decisao;
  aoCancelar: () => void;
  aoAtualizarLista: () => void;
  aoFinalizar: (resultado: ResultadoDeFinalizacao) => void;
  aoCancelada: (contagem: Contagem) => void;
};

export function DecidirContagem({ decisao, aoCancelar, aoAtualizarLista, aoFinalizar, aoCancelada }: Propriedades) {
  const { cliente } = useAutenticacao();
  const { contagem, modo } = decisao;
  const finalizando = modo === "finalizar";
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const envio = useRef(criarEnvioUnico());
  const lote = useCarregar((sinal) => obterLote(cliente, contagem.id_lote, sinal), [cliente, contagem.id_lote], finalizando);
  const previsao = lote.dados ? preverFinalizacao(lote.dados.quantidade, contagem.divergencia) : null;
  const unidade = lote.dados?.produto.unidade_medida ?? "";

  const confirmar = () => {
    const execucao = envio.current.executar(async () =>
      finalizando ? { resultado: await finalizarContagem(cliente, contagem.id_movimentacao) } : { cancelada: await cancelarContagem(cliente, contagem.id_movimentacao) },
    );
    if (execucao === null) return;
    setEnviando(true);
    setErro(null);
    execucao.then(
      (retorno) => {
        if ("resultado" in retorno) aoFinalizar(retorno.resultado);
        else aoCancelada(retorno.cancelada);
      },
      (falha: unknown) => {
        const resultado = interpretarFalhaDeDecisao(falha);
        if (resultado.atualizarLista) aoAtualizarLista();
        setErro(resultado.geral);
        setEnviando(false);
      },
    );
  };

  return (
    <Modal
      aberto
      titulo={finalizando ? "Finalizar contagem" : "Cancelar contagem"}
      bloqueado={enviando}
      aoFechar={aoCancelar}
      rodape={
        <>
          <button type="button" className="btn btn-outline" onClick={aoCancelar} disabled={enviando} data-foco-inicial="">
            Voltar
          </button>
          <button
            type="button"
            className={finalizando ? "btn btn-primary" : "btn btn-perigo"}
            onClick={confirmar}
            disabled={enviando || (finalizando && previsao?.problema != null)}
            aria-busy={enviando}
          >
            {enviando ? <span className="spinner" aria-hidden="true" /> : null}
            {enviando ? (finalizando ? "Finalizando…" : "Cancelando…") : finalizando ? "Finalizar e ajustar saldo" : "Cancelar contagem"}
          </button>
        </>
      }
    >
      <AvisoDoFormulario mensagem={erro} />
      <dl className="contagem-resumo">
        <div>
          <dt>Lote</dt>
          <dd className="codigo">{contagem.numero_lote}</dd>
        </div>
        <div>
          <dt>Saldo na contagem</dt>
          <dd>{formatarQuantidade(contagem.saldo_anterior)}</dd>
        </div>
        <div>
          <dt>Quantidade contada</dt>
          <dd>{formatarQuantidade(contagem.quantidade)}</dd>
        </div>
        <div>
          <dt>Divergência</dt>
          <dd>
            <strong>{textoDaDivergencia(contagem.divergencia, formatarQuantidade)}</strong>
          </dd>
        </div>
        {finalizando ? (
          <div>
            <dt>Saldo atual do lote</dt>
            <dd>{lote.dados ? `${formatarQuantidade(lote.dados.quantidade)} ${unidade}` : lote.erro ? "indisponível" : "carregando…"}</dd>
          </div>
        ) : null}
        {finalizando && previsao?.saldoFinal != null ? (
          <div>
            <dt>Saldo final previsto</dt>
            <dd>
              <strong>
                {formatarQuantidade(previsao.saldoFinal)} {unidade}
              </strong>
            </dd>
          </div>
        ) : null}
      </dl>
      {finalizando ? (
        <>
          <p>
            A divergência será <strong>somada ao saldo ATUAL</strong> do lote no momento da confirmação, não ao saldo que existia quando a contagem foi feita. Se houve
            movimentações depois da contagem, o saldo final reflete isso. Será gerado um ajuste de estoque, e a contagem passa a concluída.
          </p>
          {previsao?.problema === "negativo" ? <p className="form-error">O saldo atual não comporta a divergência: o saldo final ficaria negativo.</p> : null}
          {previsao?.problema === "excede" ? <p className="form-error">O saldo final excederia o limite permitido.</p> : null}
        </>
      ) : (
        <p>A contagem será cancelada e o saldo do lote não muda. Esta ação não pode ser desfeita.</p>
      )}
    </Modal>
  );
}
