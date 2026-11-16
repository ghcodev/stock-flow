import { useMemo, useRef, useState, type FormEvent } from "react";
import { registrarContagem } from "../../api/inventario.ts";
import { useAutenticacao } from "../../autenticacao/ContextoDeAutenticacao.tsx";
import { AvisoDoFormulario, CampoDeAreaDeTexto, CampoDeTexto, focarPrimeiroInvalido } from "../../componentes/Campo.tsx";
import { Icone } from "../../componentes/Icone.tsx";
import { useLeituraDoLote } from "../../hooks/useLeituraDoLote.ts";
import { formatarQuantidade } from "../../util/decimal.ts";
import { criarEnvioUnico } from "../../util/envio.ts";
import { temErrosDeCampos, type ErrosDeCampos } from "../../util/formularios.ts";
import { corpoDeContagem, divergenciaDaContagem, interpretarFalhaDeContagem, textoDaDivergencia, validarContagem } from "../../util/inventario.ts";
import { decimalValido, normalizarDecimal } from "../../util/formularios.ts";
import { ResumoDoLote } from "../movimentacao/ResumoDoLote.tsx";
import { SeletorDeLote } from "../movimentacao/SeletorDeLote.tsx";

type Propriedades = {
  aoRegistrar: (numeroDoLote: string) => void;
  aoResultadoIncerto: () => void;
};

export function FormularioDeContagem({ aoRegistrar, aoResultadoIncerto }: Propriedades) {
  const { cliente } = useAutenticacao();
  const leitura = useLeituraDoLote();
  const lote = leitura.lote;
  const [quantidade, setQuantidade] = useState("");
  const [observacao, setObservacao] = useState("");
  const [erros, setErros] = useState<ErrosDeCampos>({});
  const [geral, setGeral] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const envio = useRef(criarEnvioUnico());

  const previa = useMemo(() => {
    if (lote === null || quantidade.trim() === "" || !decimalValido(quantidade)) return null;
    return divergenciaDaContagem(normalizarDecimal(quantidade), lote.quantidade);
  }, [lote, quantidade]);

  const limpar = () => {
    setQuantidade("");
    setObservacao("");
    setErros({});
    setGeral(null);
  };

  const enviar = (evento: FormEvent<HTMLFormElement>) => {
    evento.preventDefault();
    const formulario = evento.currentTarget;
    if (lote === null || !leitura.podeEscrever || envio.current.ocupado()) return;
    const invalidos = validarContagem(quantidade, observacao);
    setErros(invalidos);
    setGeral(null);
    if (temErrosDeCampos(invalidos)) {
      focarPrimeiroInvalido(formulario);
      return;
    }
    const atual = lote;
    const execucao = envio.current.executar(() => registrarContagem(cliente, corpoDeContagem(atual.id_lote, quantidade, observacao)));
    if (execucao === null) return;
    setEnviando(true);
    execucao.then(
      () => {
        leitura.limpar();
        limpar();
        setEnviando(false);
        aoRegistrar(atual.numero_lote);
      },
      (falha: unknown) => {
        const resultado = interpretarFalhaDeContagem(falha);
        if (resultado.incerta) aoResultadoIncerto();
        setErros(resultado.campos);
        setGeral(resultado.geral);
        setEnviando(false);
        leitura.reler(atual.id_lote);
        focarPrimeiroInvalido(formulario);
      },
    );
  };

  const alterarQuantidade = (valor: string) => {
    setQuantidade(valor);
    setErros(({ quantidade: _removido, ...resto }) => resto);
  };

  const unidade = lote?.produto.unidade_medida ?? "";

  return (
    <section className="cartao" aria-label="Registrar contagem">
      <div className="cartao-cabecalho">
        <h2>Registrar contagem</h2>
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
          desabilitado={enviando}
          aoTrocar={() => {
            leitura.limpar();
            limpar();
          }}
        />
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
          <CampoDeTexto
            obrigatorio
            rotulo={`Quantidade contada${unidade ? ` (${unidade})` : ""}`}
            valor={quantidade}
            aoMudar={alterarQuantidade}
            erro={erros["quantidade"]}
            inputMode="decimal"
            ajuda={
              previa !== null && lote
                ? `Saldo registrado ${formatarQuantidade(lote.quantidade)} ${unidade}. Divergência: ${textoDaDivergencia(previa, formatarQuantidade)} ${unidade}.`
                : "Zero é permitido. Até 3 casas decimais."
            }
            desabilitado={lote === null || !leitura.podeEscrever || enviando}
          />
          <CampoDeAreaDeTexto
            rotulo="Observação (opcional)"
            valor={observacao}
            aoMudar={(valor) => {
              setObservacao(valor);
              setErros(({ observacao: _removido, ...resto }) => resto);
            }}
            erro={erros["observacao"]}
            tamanhoMaximo={5000}
            linhas={2}
            desabilitado={lote === null || !leitura.podeEscrever || enviando}
          />
          <div className="formulario-acoes">
            <button type="submit" className="btn btn-primary btn-lg" disabled={lote === null || !leitura.podeEscrever || enviando} aria-busy={enviando}>
              {enviando ? <span className="spinner" aria-hidden="true" /> : <Icone nome="clipboard" />}
              {enviando ? "Registrando…" : "Registrar contagem"}
            </button>
            {lote === null ? <span className="campo-ajuda">Selecione um lote para habilitar o registro.</span> : null}
          </div>
        </form>
        <p className="campo-ajuda">A contagem fica pendente e não altera o saldo até um administrador finalizá-la.</p>
      </div>
    </section>
  );
}
