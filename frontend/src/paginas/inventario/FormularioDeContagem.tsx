import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { registrarContagem } from "../../api/inventario.ts";
import { obterLote } from "../../api/lotes.ts";
import type { Lote } from "../../api/tipos.ts";
import { useAutenticacao } from "../../autenticacao/ContextoDeAutenticacao.tsx";
import { AvisoDoFormulario, CampoDeAreaDeTexto, CampoDeTexto, focarPrimeiroInvalido } from "../../componentes/Campo.tsx";
import { Icone } from "../../componentes/Icone.tsx";
import { formatarQuantidade } from "../../util/decimal.ts";
import { criarEnvioUnico } from "../../util/envio.ts";
import { temErrosDeCampos, type ErrosDeCampos } from "../../util/formularios.ts";
import { corpoDeContagem, divergenciaDaContagem, interpretarFalhaDeContagem, textoDaDivergencia, validarContagem } from "../../util/inventario.ts";
import { decimalValido, normalizarDecimal } from "../../util/formularios.ts";
import { criarVigencia } from "../../util/vigencia.ts";
import { ResumoDoLote } from "../movimentacao/ResumoDoLote.tsx";
import { SeletorDeLote } from "../movimentacao/SeletorDeLote.tsx";

type Propriedades = {
  aoRegistrar: (numeroDoLote: string) => void;
  aoResultadoIncerto: () => void;
};

export function FormularioDeContagem({ aoRegistrar, aoResultadoIncerto }: Propriedades) {
  const { cliente } = useAutenticacao();
  const [lote, setLote] = useState<Lote | null>(null);
  const [quantidade, setQuantidade] = useState("");
  const [observacao, setObservacao] = useState("");
  const [erros, setErros] = useState<ErrosDeCampos>({});
  const [geral, setGeral] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const envio = useRef(criarEnvioUnico());
  const vigencia = useRef(criarVigencia());

  useEffect(() => {
    const atual = vigencia.current;
    return () => atual.invalidar();
  }, []);

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

  const recarregarLote = async (id: number) => {
    const pedido = vigencia.current.iniciar();
    try {
      const atualizado = await obterLote(cliente, id, pedido.sinal);
      if (pedido.vigente()) setLote(atualizado);
    } catch {
      return;
    }
  };

  const enviar = (evento: FormEvent<HTMLFormElement>) => {
    evento.preventDefault();
    const formulario = evento.currentTarget;
    if (lote === null || envio.current.ocupado()) return;
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
        vigencia.current.invalidar();
        setLote(null);
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
        void recarregarLote(atual.id_lote);
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
            vigencia.current.invalidar();
            setLote(novo);
            limpar();
          }}
        />
        <ResumoDoLote
          lote={lote}
          desabilitado={enviando}
          aoTrocar={() => {
            vigencia.current.invalidar();
            setLote(null);
            limpar();
          }}
        />
        <AvisoDoFormulario mensagem={geral} />
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
            desabilitado={lote === null || enviando}
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
            desabilitado={lote === null || enviando}
          />
          <div className="formulario-acoes">
            <button type="submit" className="btn btn-primary btn-lg" disabled={lote === null || enviando} aria-busy={enviando}>
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
