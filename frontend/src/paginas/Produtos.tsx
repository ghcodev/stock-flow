import { useMemo, useState } from "react";
import { listarProdutos } from "../api/produtos.ts";
import type { Produto } from "../api/tipos.ts";
import { useAutenticacao } from "../autenticacao/ContextoDeAutenticacao.tsx";
import { Badge } from "../componentes/Badge.tsx";
import { CabecalhoDePagina } from "../componentes/CabecalhoDePagina.tsx";
import { CampoDeBusca } from "../componentes/CampoDeBusca.tsx";
import { useAvisos } from "../componentes/Avisos.tsx";
import { FaixaDeIndicadores } from "../componentes/FaixaDeIndicadores.tsx";
import { FiltrosRapidos, type OpcaoDeFiltro } from "../componentes/FiltrosRapidos.tsx";
import { Icone } from "../componentes/Icone.tsx";
import { MenuDeAcoes } from "../componentes/MenuDeAcoes.tsx";
import { Paginacao } from "../componentes/Paginacao.tsx";
import { Tabela, type Coluna } from "../componentes/Tabela.tsx";
import { useCarregar } from "../hooks/useCarregar.ts";
import { compararDecimais, formatarInteiro, formatarQuantidade } from "../util/decimal.ts";
import { formatarDia } from "../util/datas.ts";
import { compararTexto } from "../util/ordenacao.ts";
import { ConfirmarInativacao } from "./produtos/ConfirmarInativacao.tsx";
import { DetalhesDoProduto } from "./produtos/DetalhesDoProduto.tsx";
import { FormularioDeProduto } from "./produtos/FormularioDeProduto.tsx";

type Situacao = "todos" | "ativos" | "inativos";
type Painel = { tipo: "ver" | "editar" | "novo"; produto: Produto | null } | null;

const LIMITE = 20;

function filtroDeAtivo(situacao: Situacao): boolean | undefined {
  if (situacao === "ativos") return true;
  return situacao === "inativos" ? false : undefined;
}

export function Produtos() {
  const { cliente } = useAutenticacao();
  const { mostrar } = useAvisos();
  const [busca, setBusca] = useState("");
  const [situacao, setSituacao] = useState<Situacao>("ativos");
  const [pagina, setPagina] = useState(1);
  const [painel, setPainel] = useState<Painel>(null);
  const [paraInativar, setParaInativar] = useState<Produto | null>(null);

  const lista = useCarregar(
    (sinal) => listarProdutos(cliente, { busca: busca === "" ? undefined : busca, ativo: filtroDeAtivo(situacao), pagina, limite: LIMITE }, sinal),
    [cliente, busca, situacao, pagina],
  );

  const contagens = useCarregar(
    async (sinal) => {
      const [ativos, inativos] = await Promise.all([
        listarProdutos(cliente, { ativo: true, limite: 1 }, sinal),
        listarProdutos(cliente, { ativo: false, limite: 1 }, sinal),
      ]);
      return { ativos: ativos.total, inativos: inativos.total };
    },
    [cliente],
  );

  const recarregarTudo = () => {
    lista.recarregar();
    contagens.recarregar();
  };

  const colunas = useMemo<Coluna<Produto>[]>(
    () => [
      {
        id: "nome",
        titulo: "Produto",
        comparar: (a, b) => compararTexto(a.nome, b.nome),
        render: (produto) => (
          <>
            <button type="button" className="celula-principal" onClick={() => setPainel({ tipo: "ver", produto })}>
              {produto.nome}
            </button>
            {produto.descricao ? <div className="celula-secundaria celula-truncada">{produto.descricao}</div> : null}
          </>
        ),
      },
      {
        id: "categoria",
        titulo: "Categoria",
        comparar: (a, b) => compararTexto(a.categoria, b.categoria),
        render: (produto) => (produto.categoria ? <Badge tom="neutro">{produto.categoria}</Badge> : "—"),
      },
      { id: "unidade", titulo: "Unidade", mono: true, comparar: (a, b) => compararTexto(a.unidade_medida, b.unidade_medida), render: (produto) => produto.unidade_medida },
      {
        id: "minimo",
        titulo: "Estoque mín.",
        alinhar: "num",
        comparar: (a, b) => compararDecimais(a.estoque_minimo, b.estoque_minimo),
        render: (produto) => formatarQuantidade(produto.estoque_minimo),
      },
      {
        id: "situacao",
        titulo: "Situação",
        alinhar: "centro",
        comparar: (a, b) => Number(b.ativo) - Number(a.ativo),
        render: (produto) => (
          <Badge tom={produto.ativo ? "sucesso" : "neutro"} ponto>
            {produto.ativo ? "Ativo" : "Inativo"}
          </Badge>
        ),
      },
      {
        id: "cadastro",
        titulo: "Cadastro",
        comparar: (a, b) => compararTexto(a.created_at, b.created_at),
        render: (produto) => formatarDia(produto.created_at.slice(0, 10)),
      },
    ],
    [],
  );

  const opcoes: OpcaoDeFiltro<Situacao>[] = [
    { valor: "ativos", rotulo: "Ativos", contagem: contagens.dados?.ativos ?? null },
    { valor: "inativos", rotulo: "Inativos", contagem: contagens.dados?.inativos ?? null },
    { valor: "todos", rotulo: "Todos", contagem: contagens.dados ? contagens.dados.ativos + contagens.dados.inativos : null },
  ];

  const total = contagens.dados ? contagens.dados.ativos + contagens.dados.inativos : null;
  const linhas = lista.dados?.dados ?? [];

  return (
    <>
      <CabecalhoDePagina
        titulo="Produtos"
        resumo={[
          { texto: total === null ? "Carregando cadastros…" : <><strong>{formatarInteiro(total)}</strong> cadastros</> },
          { texto: contagens.dados ? <><strong>{formatarInteiro(contagens.dados.ativos)}</strong> ativos</> : "…" },
        ]}
        acoes={
          <>
            <button type="button" className="btn btn-outline btn-sm" onClick={recarregarTudo} disabled={lista.carregando}>
              <Icone nome="refresh" />
              Atualizar
            </button>
            <button type="button" className="btn btn-primary" onClick={() => setPainel({ tipo: "novo", produto: null })}>
              <Icone nome="plus" />
              Novo produto
            </button>
          </>
        }
      />

      <FaixaDeIndicadores
        rotulo="Resumo dos produtos"
        itens={[
          { rotulo: "Cadastrados", valor: total, detalhe: "ativos e inativos", icone: "package" },
          { rotulo: "Ativos", valor: contagens.dados?.ativos ?? null, detalhe: "aceitam novos lotes", icone: "circle-check", tom: "sucesso" },
          { rotulo: "Inativos", valor: contagens.dados?.inativos ?? null, detalhe: "não aceitam novos lotes", icone: "pause" },
        ]}
      />

      <section className="cartao" aria-label="Lista de produtos">
        <div className="barra-de-filtros">
          <CampoDeBusca
            rotulo="Buscar produtos"
            placeholder="Buscar por nome ou categoria…"
            valor={busca}
            aoBuscar={(texto) => {
              setBusca(texto);
              setPagina(1);
            }}
          />
          <FiltrosRapidos
            rotulo="Situação"
            opcoes={opcoes}
            valor={situacao}
            aoMudar={(valor) => {
              setSituacao(valor);
              setPagina(1);
            }}
          />
        </div>
        <Tabela
          rotulo="Produtos"
          colunas={colunas}
          linhas={linhas}
          chave={(produto) => produto.id_produto}
          carregando={lista.carregando}
          erro={lista.erro}
          aoTentarNovamente={lista.recarregar}
          vazio={{
            titulo: busca === "" ? "Nenhum produto encontrado" : "Nenhum produto corresponde à busca",
            descricao: busca === "" ? "Cadastre um produto para começar." : "Revise o termo ou o filtro de situação.",
          }}
          selecionada={(produto) => painel?.produto?.id_produto === produto.id_produto}
          colunaDeAcoes={(produto) => (
            <MenuDeAcoes
              rotulo={`Ações de ${produto.nome}`}
              itens={[
                { rotulo: "Visualizar", icone: "eye", aoSelecionar: () => setPainel({ tipo: "ver", produto }) },
                { rotulo: "Editar", icone: "edit", aoSelecionar: () => setPainel({ tipo: "editar", produto }) },
                { rotulo: "Inativar", icone: "pause", perigo: true, desabilitado: !produto.ativo, aoSelecionar: () => setParaInativar(produto) },
              ]}
            />
          )}
        />
        {lista.dados ? <Paginacao pagina={lista.dados.pagina} limite={lista.dados.limite} total={lista.dados.total} carregando={lista.carregando} aoMudar={setPagina} /> : null}
      </section>

      {painel?.tipo === "ver" && painel.produto ? (
        <DetalhesDoProduto
          produto={painel.produto}
          aoFechar={() => setPainel(null)}
          aoEditar={() => setPainel({ tipo: "editar", produto: painel.produto })}
          aoInativar={() => setParaInativar(painel.produto)}
        />
      ) : null}

      {painel && (painel.tipo === "editar" || painel.tipo === "novo") ? (
        <FormularioDeProduto
          key={painel.produto?.id_produto ?? "novo"}
          produto={painel.produto}
          aoFechar={() => setPainel(null)}
          aoSalvar={(salvo, criado) => {
            setPainel(null);
            mostrar("sucesso", criado ? "Produto cadastrado" : "Produto atualizado", salvo.nome);
            recarregarTudo();
          }}
        />
      ) : null}

      {paraInativar ? (
        <ConfirmarInativacao
          produto={paraInativar}
          aoCancelar={() => setParaInativar(null)}
          aoConfirmar={(produto) => {
            setParaInativar(null);
            setPainel(null);
            mostrar("sucesso", "Produto inativado", produto.nome);
            recarregarTudo();
          }}
        />
      ) : null}
    </>
  );
}
