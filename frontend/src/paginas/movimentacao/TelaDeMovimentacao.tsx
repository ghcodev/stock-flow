import { useMemo, useRef, useState, type FormEvent } from "react";
import "../../estilos/movimentacao.css";
import { buscarLocalizacoesParaSeletor } from "../../api/buscas.ts";
import { corpoDeSaldo, corpoDeTransferencia, registrarEntrada, registrarSaida, registrarTransferencia } from "../../api/movimentacoes.ts";
import type { Lote, Movimentacao } from "../../api/tipos.ts";
import { useAutenticacao } from "../../autenticacao/ContextoDeAutenticacao.tsx";
import { useAvisos } from "../../componentes/Avisos.tsx";
import { Badge } from "../../componentes/Badge.tsx";
import { CabecalhoDePagina } from "../../componentes/CabecalhoDePagina.tsx";
import { AvisoDoFormulario, CampoDeAreaDeTexto, CampoDeTexto, focarPrimeiroInvalido } from "../../componentes/Campo.tsx";
import { Icone } from "../../componentes/Icone.tsx";
import { SeletorComBusca } from "../../componentes/SeletorComBusca.tsx";
import { useLeituraDoLote } from "../../hooks/useLeituraDoLote.ts";
import { formatarDataHora } from "../../util/datas.ts";
import { formatarQuantidade } from "../../util/decimal.ts";
import { criarEnvioUnico } from "../../util/envio.ts";
import type { ErrosDeCampos } from "../../util/formularios.ts";
import {
  avaliarQuantidade,
  avisoDaEntrada,
  bloqueioDaSaida,
  bloqueioDaTransferencia,
  interpretarFalhaDeMovimentacao,
  validarDestino,
  validarJustificativa,
  validarTextoOpcional,
} from "../../util/movimentacao.ts";
import { rotuloDaLocalizacao } from "../lotes/apresentacao.ts";
import { ResumoDoLote } from "./ResumoDoLote.tsx";
import { SeletorDeLote } from "./SeletorDeLote.tsx";

export type ModoDeMovimentacao = "entrada" | "saida" | "transferencia";

type Configuracao = {
  titulo: string;
  descricao: string;
  botao: string;
  enviando: string;
  sucesso: string;
  icone: string;
};

const CONFIGURACAO: Record<ModoDeMovimentacao, Configuracao> = {
  entrada: { titulo: "Entrada de produto", descricao: "Soma uma quantidade ao saldo de um lote.", botao: "Registrar entrada", enviando: "Registrando…", sucesso: "Entrada registrada", icone: "arrow-down-left" },
  saida: { titulo: "Saída de produto", descricao: "Baixa uma quantidade do saldo de um lote ativo.", botao: "Registrar saída", enviando: "Registrando…", sucesso: "Saída registrada", icone: "arrow-up-right" },
  transferencia: { titulo: "Transferência", descricao: "Move o lote para outra localização, sem alterar o saldo.", botao: "Registrar transferência", enviando: "Transferindo…", sucesso: "Transferência registrada", icone: "shuffle" },
};

type Resultado = {
  movimentacao: Movimentacao;
  numeroDoLote: string;
  unidade: string;
  destino: string | null;
};

const CAMPOS_DA_API: Record<string, string> = { id_localizacao_destino: "destino" };

function traduzirCampos(campos: ErrosDeCampos): ErrosDeCampos {
  const traduzidos: ErrosDeCampos = {};
  for (const [campo, mensagem] of Object.entries(campos)) traduzidos[CAMPOS_DA_API[campo] ?? campo] = mensagem;
  return traduzidos;
}

export function TelaDeMovimentacao({ modo }: { modo: ModoDeMovimentacao }) {
  const { cliente } = useAutenticacao();
  const { mostrar } = useAvisos();
  const configuracao = CONFIGURACAO[modo];
  const leitura = useLeituraDoLote();
  const lote = leitura.lote;
  const [quantidade, setQuantidade] = useState("");
  const [motivo, setMotivo] = useState("");
  const [observacao, setObservacao] = useState("");
  const [destino, setDestino] = useState("");
  const [rotuloDoDestino, setRotuloDoDestino] = useState("");
  const [erros, setErros] = useState<ErrosDeCampos>({});
  const [geral, setGeral] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [chaveDoDestino, setChaveDoDestino] = useState(0);
  const envio = useRef(criarEnvioUnico());

  const avaliacao = useMemo(
    () => (lote !== null && modo !== "transferencia" ? avaliarQuantidade(quantidade, lote, modo) : { erro: null, saldoApos: null }),
    [lote, quantidade, modo],
  );
  const bloqueio = lote === null ? null : modo === "saida" ? bloqueioDaSaida(lote) : modo === "transferencia" ? bloqueioDaTransferencia(lote) : null;
  const avisoDeEntrada = lote !== null && modo === "entrada" ? avisoDaEntrada(lote) : null;
  const aviso = bloqueio !== null ? { tom: "perigo" as const, texto: bloqueio } : avisoDeEntrada !== null ? { tom: "alerta" as const, texto: avisoDeEntrada } : null;

  const limparFormulario = () => {
    setQuantidade("");
    setMotivo("");
    setObservacao("");
    setDestino("");
    setRotuloDoDestino("");
    setChaveDoDestino((atual) => atual + 1);
    setErros({});
    setGeral(null);
  };

  const escolher = (novo: Lote) => {
    leitura.escolher(novo);
    limparFormulario();
  };

  const alterar = (campo: string, aplicar: (valor: string) => void) => (valor: string) => {
    aplicar(valor);
    setErros(({ [campo]: _removido, ...resto }) => resto);
  };

  const validar = (atual: Lote): ErrosDeCampos => {
    const invalidos: ErrosDeCampos = {};
    if (modo === "transferencia") {
      const erroDestino = validarDestino(atual, destino);
      if (erroDestino) invalidos["destino"] = erroDestino;
      const erroJustificativa = validarJustificativa(motivo);
      if (erroJustificativa) invalidos["motivo"] = erroJustificativa;
    } else {
      if (quantidade.trim() === "") invalidos["quantidade"] = "Informe a quantidade.";
      else if (avaliacao.erro) invalidos["quantidade"] = avaliacao.erro;
      const erroMotivo = validarTextoOpcional(motivo, 255, "O motivo");
      if (erroMotivo) invalidos["motivo"] = erroMotivo;
    }
    const erroObservacao = validarTextoOpcional(observacao, 5000, "A observação");
    if (erroObservacao) invalidos["observacao"] = erroObservacao;
    return invalidos;
  };

  const enviar = (evento: FormEvent<HTMLFormElement>) => {
    evento.preventDefault();
    const formulario = evento.currentTarget;
    if (lote === null || !leitura.podeEscrever || envio.current.ocupado()) return;
    if (bloqueio !== null) {
      setGeral(bloqueio);
      return;
    }
    const invalidos = validar(lote);
    setErros(invalidos);
    setGeral(null);
    if (Object.keys(invalidos).length > 0) {
      focarPrimeiroInvalido(formulario);
      return;
    }
    const atual = lote;
    const execucao = envio.current.executar(async () => {
      if (modo === "transferencia") return registrarTransferencia(cliente, corpoDeTransferencia(atual.id_lote, Number(destino), motivo, observacao));
      const corpo = corpoDeSaldo(atual.id_lote, quantidade, motivo, observacao);
      return modo === "entrada" ? registrarEntrada(cliente, corpo) : registrarSaida(cliente, corpo);
    });
    if (execucao === null) return;
    setEnviando(true);
    execucao.then(
      (movimentacao) => {
        setResultado({ movimentacao, numeroDoLote: atual.numero_lote, unidade: atual.produto.unidade_medida, destino: modo === "transferencia" ? rotuloDoDestino : null });
        mostrar("sucesso", configuracao.sucesso, `${atual.numero_lote} · saldo ${formatarQuantidade(movimentacao.saldo_posterior)} ${atual.produto.unidade_medida}`);
        leitura.limpar();
        limparFormulario();
        setEnviando(false);
        if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
      },
      (erro: unknown) => {
        const falha = interpretarFalhaDeMovimentacao(erro);
        setErros(traduzirCampos(falha.campos));
        setGeral(falha.geral);
        setEnviando(false);
        if (falha.atualizarLote) leitura.reler(atual.id_lote);
        focarPrimeiroInvalido(formulario);
      },
    );
  };

  const semLote = lote === null;
  const desabilitado = semLote || enviando || !leitura.podeEscrever;

  return (
    <>
      <CabecalhoDePagina titulo={configuracao.titulo} resumo={[{ texto: configuracao.descricao }]} />

      <div className="movimentacao-grade">
        <section className="cartao" aria-label="Lote">
          <div className="cartao-cabecalho">
            <h2>1. Lote</h2>
          </div>
          <div className="cartao-corpo">
            <SeletorDeLote ocupado={enviando} aoEscolher={escolher} />
            <ResumoDoLote
              lote={lote}
              aviso={aviso}
              desabilitado={enviando}
              aoTrocar={() => {
                leitura.limpar();
                limparFormulario();
              }}
            />
          </div>
        </section>

        <section className="cartao" aria-label="Dados da movimentação">
          <div className="cartao-cabecalho">
            <h2>2. Dados da movimentação</h2>
          </div>
          <div className="cartao-corpo">
            <AvisoDoFormulario mensagem={geral} />
            {leitura.estado === "falhou" && lote ? (
              <div className="aviso-do-formulario" role="alert">
                <span>Não foi possível ler o saldo atual do lote, então o registro está bloqueado.</span>
                <button type="button" className="btn btn-outline btn-sm" onClick={() => leitura.reler(lote.id_lote)}>
                  Ler de novo
                </button>
              </div>
            ) : null}
            {leitura.estado === "pendente" ? <p className="campo-ajuda">Lendo o saldo atual do lote…</p> : null}
            <form className="formulario" onSubmit={enviar} noValidate aria-busy={enviando}>
              {modo === "transferencia" ? (
                <>
                  <CampoDeTexto rotulo="Origem (localização atual)" valor={lote ? rotuloDaLocalizacao(lote.localizacao) : ""} aoMudar={() => undefined} desabilitado ajuda="A origem é sempre a localização atual do lote." />
                  <SeletorComBusca
                    key={chaveDoDestino}
                    obrigatorio
                    rotulo="Destino"
                    placeholder="Ex.: B-2-03"
                    valor={destino}
                    aoMudar={(valor, rotulo) => {
                      alterar("destino", setDestino)(valor);
                      setRotuloDoDestino(rotulo);
                    }}
                    buscar={(texto, sinal) => buscarLocalizacoesParaSeletor(cliente, texto, sinal)}
                    erro={erros["destino"]}
                    desabilitado={desabilitado}
                  />
                  <CampoDeTexto
                    obrigatorio
                    rotulo="Justificativa"
                    valor={motivo}
                    aoMudar={alterar("motivo", setMotivo)}
                    erro={erros["motivo"]}
                    tamanhoMaximo={255}
                    desabilitado={desabilitado}
                  />
                </>
              ) : (
                <>
                  <CampoDeTexto
                    obrigatorio
                    rotulo={`Quantidade${lote ? ` (${lote.produto.unidade_medida})` : ""}`}
                    valor={quantidade}
                    aoMudar={alterar("quantidade", setQuantidade)}
                    erro={erros["quantidade"] ?? avaliacao.erro ?? undefined}
                    inputMode="decimal"
                    ajuda={avaliacao.saldoApos !== null && lote ? `Saldo após a operação: ${formatarQuantidade(avaliacao.saldoApos)} ${lote.produto.unidade_medida}` : "Até 3 casas decimais."}
                    desabilitado={desabilitado}
                  />
                  <CampoDeTexto rotulo="Motivo (opcional)" valor={motivo} aoMudar={alterar("motivo", setMotivo)} erro={erros["motivo"]} tamanhoMaximo={255} desabilitado={desabilitado} />
                </>
              )}
              <CampoDeAreaDeTexto rotulo="Observações (opcional)" valor={observacao} aoMudar={alterar("observacao", setObservacao)} erro={erros["observacao"]} tamanhoMaximo={5000} linhas={2} desabilitado={desabilitado} />
              <div className="formulario-acoes">
                <button type="submit" className="btn btn-primary btn-lg" disabled={desabilitado || bloqueio !== null} aria-busy={enviando}>
                  {enviando ? <span className="spinner" aria-hidden="true" /> : <Icone nome={configuracao.icone} />}
                  {enviando ? configuracao.enviando : configuracao.botao}
                </button>
                {semLote ? <span className="campo-ajuda">Selecione um lote para habilitar o registro.</span> : null}
                {bloqueio !== null ? <span className="campo-ajuda">{bloqueio}</span> : null}
              </div>
            </form>

            {resultado ? (
              <div className="resultado-movimentacao" role="status" aria-live="polite">
                <div className="resultado-movimentacao-titulo">
                  <Badge tom="sucesso" ponto>
                    {CONFIGURACAO[resultado.movimentacao.tipo_movimentacao as ModoDeMovimentacao]?.sucesso ?? "Movimentação registrada"}
                  </Badge>
                  <span className="celula-secundaria">{formatarDataHora(resultado.movimentacao.data_movimentacao)}</span>
                </div>
                <div className="resultado-movimentacao-corpo">
                  <span className="codigo">{resultado.numeroDoLote}</span>
                  {modo === "transferencia" && resultado.destino ? <span>para {resultado.destino}</span> : <span>{formatarQuantidade(resultado.movimentacao.quantidade)} {resultado.unidade}</span>}
                </div>
                <div className="resultado-movimentacao-saldo">
                  Saldo: {formatarQuantidade(resultado.movimentacao.saldo_anterior)} → <strong>{formatarQuantidade(resultado.movimentacao.saldo_posterior)} {resultado.unidade}</strong>
                </div>
              </div>
            ) : null}
          </div>
        </section>
      </div>
    </>
  );
}
