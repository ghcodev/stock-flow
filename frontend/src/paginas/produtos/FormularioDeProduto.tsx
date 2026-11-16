import { useState, type FormEvent } from "react";
import { atualizarProduto, corpoDeProduto, criarProduto } from "../../api/produtos.ts";
import type { Produto } from "../../api/tipos.ts";
import { useAutenticacao } from "../../autenticacao/ContextoDeAutenticacao.tsx";
import { AvisoDoFormulario, CampoDeAreaDeTexto, CampoDeTexto, focarPrimeiroInvalido } from "../../componentes/Campo.tsx";
import { Gaveta } from "../../componentes/Gaveta.tsx";
import { Icone } from "../../componentes/Icone.tsx";
import { interpretarFalhaDeFormulario, temErrosDeCampos, validarProduto, type ErrosDeCampos, type ValoresDeProduto } from "../../util/formularios.ts";

type Propriedades = {
  produto: Produto | null;
  aoFechar: () => void;
  aoSalvar: (produto: Produto, criado: boolean) => void;
};

export const ID_DO_FORMULARIO_DE_PRODUTO = "formulario-de-produto";

function valoresIniciais(produto: Produto | null): ValoresDeProduto {
  return {
    nome: produto?.nome ?? "",
    categoria: produto?.categoria ?? "",
    descricao: produto?.descricao ?? "",
    unidade_medida: produto?.unidade_medida ?? "",
    estoque_minimo: produto ? produto.estoque_minimo.replace(".", ",") : "",
  };
}

export function FormularioDeProduto({ produto, aoFechar, aoSalvar }: Propriedades) {
  const { cliente } = useAutenticacao();
  const [valores, setValores] = useState<ValoresDeProduto>(() => valoresIniciais(produto));
  const [erros, setErros] = useState<ErrosDeCampos>({});
  const [geral, setGeral] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const alterar = (campo: keyof ValoresDeProduto) => (valor: string) => {
    setValores((atuais) => ({ ...atuais, [campo]: valor }));
    setErros(({ [campo]: _removido, ...resto }) => resto);
  };

  const enviar = async (evento: FormEvent<HTMLFormElement>) => {
    evento.preventDefault();
    const formulario = evento.currentTarget;
    if (enviando) return;
    const invalidos = validarProduto(valores);
    setErros(invalidos);
    setGeral(null);
    if (temErrosDeCampos(invalidos)) {
      focarPrimeiroInvalido(formulario);
      return;
    }
    setEnviando(true);
    try {
      const modo = produto ? "editar" : "criar";
      const corpo = corpoDeProduto(valores, modo);
      const salvo = produto ? await atualizarProduto(cliente, produto.id_produto, corpo) : await criarProduto(cliente, corpo);
      aoSalvar(salvo, produto === null);
    } catch (erro) {
      const falha = interpretarFalhaDeFormulario(erro);
      setErros(falha.campos);
      setGeral(falha.geral);
      setEnviando(false);
      focarPrimeiroInvalido(formulario);
    }
  };

  return (
    <Gaveta
      aberta
      titulo={produto ? "Editar produto" : "Novo produto"}
      subtitulo={produto ? `#${produto.id_produto}` : undefined}
      aoFechar={aoFechar}
      rodape={
        <>
          <button type="button" className="btn btn-outline" onClick={aoFechar} disabled={enviando}>
            Cancelar
          </button>
          <button type="submit" form={ID_DO_FORMULARIO_DE_PRODUTO} className="btn btn-primary" disabled={enviando} aria-busy={enviando}>
            {enviando ? <span className="spinner" aria-hidden="true" /> : <Icone nome="check" />}
            {enviando ? "Salvando…" : "Salvar"}
          </button>
        </>
      }
    >
      <AvisoDoFormulario mensagem={geral} />
      <form id={ID_DO_FORMULARIO_DE_PRODUTO} className="formulario formulario--duas-colunas" onSubmit={enviar} noValidate>
        <CampoDeTexto largo obrigatorio autoFoco rotulo="Nome" valor={valores.nome} aoMudar={alterar("nome")} erro={erros["nome"]} tamanhoMaximo={120} desabilitado={enviando} />
        <CampoDeTexto rotulo="Categoria" valor={valores.categoria} aoMudar={alterar("categoria")} erro={erros["categoria"]} tamanhoMaximo={60} desabilitado={enviando} />
        <CampoDeTexto
          obrigatorio
          rotulo="Unidade de medida"
          valor={valores.unidade_medida}
          aoMudar={alterar("unidade_medida")}
          erro={erros["unidade_medida"]}
          tamanhoMaximo={10}
          ajuda="Ex.: kg, un, cx"
          desabilitado={enviando}
        />
        <CampoDeTexto
          rotulo="Estoque mínimo"
          valor={valores.estoque_minimo}
          aoMudar={alterar("estoque_minimo")}
          erro={erros["estoque_minimo"]}
          inputMode="decimal"
          ajuda="Alerta quando a soma dos lotes ativos ficar abaixo."
          desabilitado={enviando}
        />
        <CampoDeAreaDeTexto largo rotulo="Descrição" valor={valores.descricao} aoMudar={alterar("descricao")} erro={erros["descricao"]} tamanhoMaximo={5000} desabilitado={enviando} />
      </form>
    </Gaveta>
  );
}
