import { useRef, useState, type FormEvent } from "react";
import { registrarAjuste } from "../api/movimentacoes.ts";
import type { Movimentacao } from "../api/tipos.ts";
import { useAutenticacao } from "../autenticacao/ContextoDeAutenticacao.tsx";
import { useAvisos } from "../componentes/Avisos.tsx";
import { Badge } from "../componentes/Badge.tsx";
import { CabecalhoDePagina } from "../componentes/CabecalhoDePagina.tsx";
import { AvisoDoFormulario, CampoDeAreaDeTexto, CampoDeTexto, focarPrimeiroInvalido } from "../componentes/Campo.tsx";
import { Icone } from "../componentes/Icone.tsx";
import { Modal } from "../componentes/Modal.tsx";
import { avisoDoAjuste, corpoDeAjuste, interpretarFalhaDeAjuste, MAXIMO_DA_JUSTIFICATIVA, validarAjuste } from "../util/ajuste.ts";
import { formatarDataHoraUtc } from "../util/datas.ts";
import { formatarQuantidade } from "../util/decimal.ts";
import { criarEnvioUnico } from "../util/envio.ts";
import { normalizarDecimal, temErrosDeCampos, type ErrosDeCampos } from "../util/formularios.ts";
import { useLeituraDoLote } from "../hooks/useLeituraDoLote.ts";
import { ResumoDoLote } from "./movimentacao/ResumoDoLote.tsx";
import { SeletorDeLote } from "./movimentacao/SeletorDeLote.tsx";
import "../estilos/administracao.css";
import "../estilos/movimentacao.css";

type Resultado = { movimentacao: Movimentacao; numeroDoLote: string; unidade: string };

export function Ajuste() {
  const { cliente } = useAutenticacao();
  const { mostrar } = useAvisos();
  const leitura = useLeituraDoLote();
  const lote = leitura.lote;
  const [novoSaldo, setNovoSaldo] = useState("");
  const [justificativa, setJustificativa] = useState("");
  const [erros, setErros] = useState<ErrosDeCampos>({});
  const [geral, setGeral] = useState<string | null>(null);
  const [confirmando, setConfirmando] = useState(false);
  const [erroDaConfirmacao, setErroDaConfirmacao] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const envio = useRef(criarEnvioUnico());

  const limpar = () => {
    setNovoSaldo("");
    setJustificativa("");
    setErros({});
    setGeral(null);
    setConfirmando(false);
    setErroDaConfirmacao(null);
  };

  const alterar = (campo: string, aplicar: (valor: string) => void) => (valor: string) => {
    aplicar(valor);
    setErros(({ [campo]: _removido, ...resto }) => resto);
  };

  const revisar = (evento: FormEvent<HTMLFormElement>) => {
    evento.preventDefault();
    const formulario = evento.currentTarget;
    if (lote === null || !leitura.podeEscrever || envio.current.ocupado()) return;
    const invalidos = validarAjuste(lote, novoSaldo, justificativa);
    setErros(invalidos);
    setGeral(null);
    if (temErrosDeCampos(invalidos)) {
      focarPrimeiroInvalido(formulario);
      return;
    }
    setErroDaConfirmacao(null);
    setConfirmando(true);
  };

  const gravar = () => {
    if (lote === null || !leitura.podeEscrever) return;
    const atual = lote;
    const execucao = envio.current.executar(() => registrarAjuste(cliente, corpoDeAjuste(atual, novoSaldo, justificativa)));
    if (execucao === null) return;
    setEnviando(true);
    setErroDaConfirmacao(null);
    execucao.then(
      (movimentacao) => {
        setResultado({ movimentacao, numeroDoLote: atual.numero_lote, unidade: atual.produto.unidade_medida });
        mostrar("sucesso", "Ajuste registrado", `${atual.numero_lote} · saldo ${formatarQuantidade(movimentacao.saldo_posterior)} ${atual.produto.unidade_medida}`);
        leitura.limpar();
        limpar();
        setEnviando(false);
      },
      (falha: unknown) => {
        const resultadoDaFalha = interpretarFalhaDeAjuste(falha);
        setConfirmando(false);
        setErros(resultadoDaFalha.campos);
        setGeral(resultadoDaFalha.geral);
        setEnviando(false);
        if (resultadoDaFalha.atualizarLote) leitura.reler(atual.id_lote);
      },
    );
  };

  const aviso = lote === null ? null : avisoDoAjuste(lote);
  const unidade = lote?.produto.unidade_medida ?? "";
  const tamanho = justificativa.trim().length;
  const semLote = lote === null;
  const desabilitado = semLote || enviando || !leitura.podeEscrever;

  return (
    <>
      <CabecalhoDePagina titulo="Ajuste de estoque" resumo={[{ texto: "Corrige o saldo de um lote com justificativa registrada na auditoria" }, { texto: "Somente administrador" }]} />

      <div className="movimentacao-grade">
        <section className="cartao" aria-label="Lote">
          <div className="cartao-cabecalho">
            <h2>1. Lote</h2>
          </div>
          <div className="cartao-corpo">
            <SeletorDeLote
              ocupado={enviando}
              aoEscolher={(novo) => {
                leitura.escolher(novo);
                limpar();
              }}
            />
            <ResumoDoLote
              lote={lote}
              aviso={aviso !== null ? { tom: "alerta", texto: aviso } : null}
              desabilitado={enviando}
              aoTrocar={() => {
                leitura.limpar();
                limpar();
              }}
            />
          </div>
        </section>

        <section className="cartao" aria-label="Dados do ajuste">
          <div className="cartao-cabecalho">
            <h2>2. Novo saldo e justificativa</h2>
          </div>
          <div className="cartao-corpo">
            <AvisoDoFormulario mensagem={geral} />
            {leitura.estado === "falhou" && lote ? (
              <div className="aviso-do-formulario" role="alert">
                <span>Não foi possível ler o saldo atual do lote, então o ajuste está bloqueado.</span>
                <button type="button" className="btn btn-outline btn-sm" onClick={() => leitura.reler(lote.id_lote)}>
                  Ler de novo
                </button>
              </div>
            ) : null}
            {leitura.estado === "pendente" ? <p className="campo-ajuda">Lendo o saldo atual do lote…</p> : null}
            <form className="formulario" onSubmit={revisar} noValidate aria-busy={enviando}>
              <CampoDeTexto
                rotulo="Saldo exibido"
                valor={lote ? `${formatarQuantidade(lote.quantidade)} ${unidade}` : ""}
                aoMudar={() => undefined}
                desabilitado
                ajuda="Enviado como está no sistema para detectar mudança no meio do caminho."
              />
              <CampoDeTexto
                obrigatorio
                rotulo={`Novo saldo${unidade ? ` (${unidade})` : ""}`}
                valor={novoSaldo}
                aoMudar={alterar("novo_saldo", setNovoSaldo)}
                erro={erros["novo_saldo"]}
                inputMode="decimal"
                ajuda="Zero é permitido. Até 3 casas decimais."
                desabilitado={desabilitado}
              />
              <CampoDeAreaDeTexto
                obrigatorio
                rotulo="Justificativa"
                valor={justificativa}
                aoMudar={alterar("motivo", setJustificativa)}
                erro={erros["motivo"]}
                tamanhoMaximo={MAXIMO_DA_JUSTIFICATIVA + 20}
                ajuda={`${tamanho} de ${MAXIMO_DA_JUSTIFICATIVA} caracteres (mínimo 10).`}
                linhas={3}
                desabilitado={desabilitado}
              />
              <div className="formulario-acoes">
                <button type="submit" className="btn btn-primary btn-lg" disabled={desabilitado}>
                  <Icone nome="sliders" />
                  Revisar ajuste
                </button>
                {semLote ? <span className="campo-ajuda">Selecione um lote para habilitar o ajuste.</span> : null}
              </div>
            </form>

            {resultado ? (
              <div className="resultado-movimentacao" role="status" aria-live="polite">
                <div className="resultado-movimentacao-titulo">
                  <Badge tom="sucesso" ponto>
                    Ajuste registrado
                  </Badge>
                  <span className="celula-secundaria">{formatarDataHoraUtc(resultado.movimentacao.data_movimentacao)} UTC</span>
                </div>
                <div className="resultado-movimentacao-corpo">
                  <span className="codigo">{resultado.numeroDoLote}</span>
                </div>
                <div className="resultado-movimentacao-saldo">
                  Saldo: {formatarQuantidade(resultado.movimentacao.saldo_anterior)} → <strong>{formatarQuantidade(resultado.movimentacao.saldo_posterior)} {resultado.unidade}</strong>
                </div>
              </div>
            ) : null}
          </div>
        </section>
      </div>

      {confirmando && lote ? (
        <Modal
          aberto
          titulo="Confirmar ajuste de estoque"
          bloqueado={enviando}
          aoFechar={() => setConfirmando(false)}
          rodape={
            <>
              <button type="button" className="btn btn-outline" onClick={() => setConfirmando(false)} disabled={enviando} data-foco-inicial="">
                Voltar
              </button>
              <button type="button" className="btn btn-primary" onClick={gravar} disabled={enviando} aria-busy={enviando}>
                {enviando ? <span className="spinner" aria-hidden="true" /> : null}
                {enviando ? "Gravando…" : "Gravar ajuste"}
              </button>
            </>
          }
        >
          <AvisoDoFormulario mensagem={erroDaConfirmacao} />
          <dl className="contagem-resumo">
            <div>
              <dt>Lote</dt>
              <dd className="codigo">{lote.numero_lote}</dd>
            </div>
            <div>
              <dt>Saldo atual</dt>
              <dd>
                {formatarQuantidade(lote.quantidade)} {unidade}
              </dd>
            </div>
            <div>
              <dt>Novo saldo</dt>
              <dd>
                <strong>
                  {formatarQuantidade(normalizarDecimal(novoSaldo))} {unidade}
                </strong>
              </dd>
            </div>
          </dl>
          <p>
            O saldo do lote mudará de <strong>{formatarQuantidade(lote.quantidade)}</strong> para <strong>{formatarQuantidade(normalizarDecimal(novoSaldo))}</strong> {unidade}. Justificativa: {justificativa.trim()}
          </p>
          {aviso ? <p className="form-error">{aviso}</p> : null}
        </Modal>
      ) : null}
    </>
  );
}
