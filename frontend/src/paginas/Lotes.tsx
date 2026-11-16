import { useMemo, useState } from "react";
import { buscarLotePorEtiqueta, contarLotes, contarLotesAVencer, desbloquearLote, listarLotes, obterLote } from "../api/lotes.ts";
import { buscarLocalizacoesParaSeletor, buscarProdutosParaSeletor } from "../api/buscas.ts";
import type { Lote, StatusLote } from "../api/tipos.ts";
import { mensagemDoErro } from "../api/erros.ts";
import { useAutenticacao } from "../autenticacao/ContextoDeAutenticacao.tsx";
import { useAvisos } from "../componentes/Avisos.tsx";
import { Badge } from "../componentes/Badge.tsx";
import { CabecalhoDePagina } from "../componentes/CabecalhoDePagina.tsx";
import { CampoDeBusca } from "../componentes/CampoDeBusca.tsx";
import { FaixaDeIndicadores } from "../componentes/FaixaDeIndicadores.tsx";
import { FiltrosRapidos, type OpcaoDeFiltro } from "../componentes/FiltrosRapidos.tsx";
import { Icone } from "../componentes/Icone.tsx";
import { SeletorComBusca } from "../componentes/SeletorComBusca.tsx";
import { MenuDeAcoes, type ItemDeMenu } from "../componentes/MenuDeAcoes.tsx";
import { Paginacao } from "../componentes/Paginacao.tsx";
import { Tabela, type Coluna } from "../componentes/Tabela.tsx";
import { useCarregar } from "../hooks/useCarregar.ts";
import { normalizarCodigoLido } from "../leitor/captura.ts";
import type { Leitura } from "../leitor/detector.ts";
import { IndicadorDeLeitura } from "../leitor/IndicadorDeLeitura.tsx";
import { useLeitor } from "../leitor/useLeitor.ts";
import { compararDias, diaDeHoje, formatarDia } from "../util/datas.ts";
import { compararDecimais, formatarInteiro, formatarQuantidade } from "../util/decimal.ts";
import { interpretarFalhaDeFormulario } from "../util/formularios.ts";
import { compararTexto } from "../util/ordenacao.ts";
import { AssociarEtiqueta } from "./lotes/AssociarEtiqueta.tsx";
import { BloquearLote } from "./lotes/BloquearLote.tsx";
import { DetalhesDoLote } from "./lotes/DetalhesDoLote.tsx";
import { FormularioDeLote } from "./lotes/FormularioDeLote.tsx";
import { ROTULOS_DE_ETIQUETA, ROTULOS_DE_STATUS, TONS_DE_STATUS, rotuloDaLocalizacao, situacaoDeValidade } from "./lotes/apresentacao.ts";

type FiltroDeStatus = "todos" | StatusLote;
type Painel = { tipo: "ver"; lote: Lote } | { tipo: "novo" } | null;

const LIMITE = 20;

export function Lotes() {
  const { cliente } = useAutenticacao();
  const { mostrar } = useAvisos();
  const [busca, setBusca] = useState("");
  const [status, setStatus] = useState<FiltroDeStatus>("todos");
  const [idProduto, setIdProduto] = useState("");
  const [idLocalizacao, setIdLocalizacao] = useState("");
  const [pagina, setPagina] = useState(1);
  const [painel, setPainel] = useState<Painel>(null);
  const [paraBloquear, setParaBloquear] = useState<Lote | null>(null);
  const [paraEtiquetar, setParaEtiquetar] = useState<Lote | null>(null);

  const lista = useCarregar(
    (sinal) =>
      listarLotes(
        cliente,
        {
          numero_lote: busca === "" ? undefined : busca,
          status: status === "todos" ? undefined : status,
          id_produto: idProduto === "" ? undefined : Number(idProduto),
          id_localizacao: idLocalizacao === "" ? undefined : Number(idLocalizacao),
          pagina,
          limite: LIMITE,
        },
        sinal,
      ),
    [cliente, busca, status, idProduto, idLocalizacao, pagina],
  );

  const contagens = useCarregar(async (sinal) => {
    const [todos, ativos, bloqueados, vencidos, aVencer] = await Promise.all([
      contarLotes(cliente, undefined, sinal),
      contarLotes(cliente, "ativo", sinal),
      contarLotes(cliente, "bloqueado", sinal),
      contarLotes(cliente, "vencido", sinal),
      contarLotesAVencer(cliente, sinal),
    ]);
    return { todos, ativos, bloqueados, vencidos, aVencer };
  }, [cliente]);

  const procurarPorEtiqueta = async (codigoBruto: string) => {
    const codigo = normalizarCodigoLido(codigoBruto);
    if (codigo === null) {
      mostrar("erro", "Código inválido", "A etiqueta deve ter de 1 a 128 caracteres, sem caracteres de controle.");
      return;
    }
    const resumo = codigo.length > 40 ? `${codigo.slice(0, 40)}…` : codigo;
    try {
      const lote = await buscarLotePorEtiqueta(cliente, codigo);
      if (lote === null) mostrar("info", "Etiqueta sem lote", resumo);
      else setPainel({ tipo: "ver", lote });
    } catch (falha) {
      mostrar("erro", "Não foi possível buscar a etiqueta", mensagemDoErro(falha));
    }
  };

  const leitor = useLeitor((leitura: Leitura) => {
    void procurarPorEtiqueta(leitura.codigo);
  });

  const recarregarTudo = () => {
    lista.recarregar();
    contagens.recarregar();
  };

  const aposAcao = async (idLote: number, titulo: string, mensagem: string) => {
    mostrar("sucesso", titulo, mensagem);
    recarregarTudo();
    try {
      setPainel({ tipo: "ver", lote: await obterLote(cliente, idLote) });
    } catch {
      setPainel(null);
    }
  };

  const desbloquearDireto = async (lote: Lote) => {
    try {
      await desbloquearLote(cliente, lote.id_lote);
      mostrar("sucesso", "Lote desbloqueado", lote.numero_lote);
      recarregarTudo();
    } catch (falha) {
      mostrar("erro", "Não foi possível desbloquear", interpretarFalhaDeFormulario(falha).geral ?? undefined);
      recarregarTudo();
    }
  };

  const hoje = diaDeHoje();

  const colunas = useMemo<Coluna<Lote>[]>(
    () => [
      {
        id: "numero",
        titulo: "Lote",
        comparar: (a, b) => compararTexto(a.numero_lote, b.numero_lote),
        render: (lote) => (
          <button type="button" className="celula-principal celula-principal--mono" onClick={() => setPainel({ tipo: "ver", lote })}>
            {lote.numero_lote}
          </button>
        ),
      },
      {
        id: "produto",
        titulo: "Produto",
        comparar: (a, b) => compararTexto(a.produto.nome, b.produto.nome),
        render: (lote) => (
          <>
            <div className="celula-truncada">{lote.produto.nome}</div>
            <div className="celula-secundaria">{lote.produto.unidade_medida}</div>
          </>
        ),
      },
      { id: "fabricacao", titulo: "Fabricação", comparar: (a, b) => compararDias(a.data_fabricacao, b.data_fabricacao), render: (lote) => formatarDia(lote.data_fabricacao) },
      {
        id: "validade",
        titulo: "Validade",
        comparar: (a, b) => compararDias(a.data_validade, b.data_validade),
        render: (lote) => {
          const situacao = situacaoDeValidade(lote, hoje);
          return (
            <>
              {formatarDia(lote.data_validade)}
              {situacao ? <div className={situacao.tom === "perigo" ? "celula-validade celula-validade--perigo" : "celula-validade celula-validade--alerta"}>{situacao.texto}</div> : null}
            </>
          );
        },
      },
      { id: "quantidade", titulo: "Saldo", alinhar: "num", comparar: (a, b) => compararDecimais(a.quantidade, b.quantidade), render: (lote) => formatarQuantidade(lote.quantidade) },
      {
        id: "etiqueta",
        titulo: "Etiqueta",
        render: (lote) =>
          lote.identificacao ? (
            <>
              <span className="etiqueta-codigo" title={lote.identificacao.codigo}>
                {lote.identificacao.codigo}
              </span>
              <div className="celula-secundaria">{ROTULOS_DE_ETIQUETA[lote.identificacao.tipo_identificacao]}</div>
            </>
          ) : (
            "—"
          ),
      },
      { id: "localizacao", titulo: "Localização", mono: true, comparar: (a, b) => compararTexto(rotuloDaLocalizacao(a.localizacao), rotuloDaLocalizacao(b.localizacao)), render: (lote) => rotuloDaLocalizacao(lote.localizacao) },
      {
        id: "status",
        titulo: "Status",
        alinhar: "centro",
        comparar: (a, b) => compararTexto(a.status_lote, b.status_lote),
        render: (lote) => (
          <Badge tom={TONS_DE_STATUS[lote.status_lote]} ponto>
            {ROTULOS_DE_STATUS[lote.status_lote]}
          </Badge>
        ),
      },
    ],
    [hoje],
  );

  const opcoes: OpcaoDeFiltro<FiltroDeStatus>[] = [
    { valor: "todos", rotulo: "Todos", contagem: contagens.dados?.todos ?? null },
    { valor: "ativo", rotulo: "Ativos", contagem: contagens.dados?.ativos ?? null },
    { valor: "bloqueado", rotulo: "Bloqueados", contagem: contagens.dados?.bloqueados ?? null },
    { valor: "vencido", rotulo: "Vencidos", contagem: contagens.dados?.vencidos ?? null },
  ];

  const itensDoMenu = (lote: Lote): ItemDeMenu[] => {
    const itens: ItemDeMenu[] = [{ rotulo: "Ver detalhes", icone: "eye", aoSelecionar: () => setPainel({ tipo: "ver", lote }) }];
    if (lote.status_lote === "ativo") itens.push({ rotulo: "Bloquear", icone: "lock", perigo: true, aoSelecionar: () => setParaBloquear(lote) });
    if (lote.status_lote === "bloqueado") {
      itens.push({ rotulo: "Desbloquear", icone: "unlock", aoSelecionar: () => void desbloquearDireto(lote) });
    }
    if (lote.identificacao === null) itens.push({ rotulo: "Associar etiqueta", icone: "tag", aoSelecionar: () => setParaEtiquetar(lote) });
    return itens;
  };

  const linhas = lista.dados?.dados ?? [];
  const filtrosAtivos = busca !== "" || idProduto !== "" || idLocalizacao !== "" || status !== "todos";

  return (
    <>
      <CabecalhoDePagina
        titulo="Lotes"
        resumo={[
          { texto: contagens.dados ? <><strong>{formatarInteiro(contagens.dados.ativos)}</strong> ativos</> : "Carregando…" },
          { texto: contagens.dados ? <><strong>{formatarInteiro(contagens.dados.aVencer)}</strong> vencendo em 30 dias</> : "…", tom: "alerta" },
          { texto: contagens.dados ? <><strong>{formatarInteiro(contagens.dados.bloqueados)}</strong> bloqueados</> : "…", tom: "perigo" },
        ]}
        acoes={
          <>
            <IndicadorDeLeitura leitor={leitor} />
            <button type="button" className="btn btn-outline btn-sm" onClick={recarregarTudo} disabled={lista.carregando}>
              <Icone nome="refresh" />
              Atualizar
            </button>
            <button type="button" className="btn btn-primary" onClick={() => setPainel({ tipo: "novo" })}>
              <Icone nome="plus" />
              Registrar lote
            </button>
          </>
        }
      />

      <FaixaDeIndicadores
        rotulo="Resumo dos lotes"
        itens={[
          { rotulo: "Ativos", valor: contagens.dados?.ativos ?? null, detalhe: "disponíveis para movimentação", icone: "layers", tom: "sucesso" },
          { rotulo: "Vencendo em 30 dias", valor: contagens.dados?.aVencer ?? null, detalhe: "lotes ativos com validade próxima", icone: "clock", tom: contagens.dados && contagens.dados.aVencer > 0 ? "alerta" : undefined },
          { rotulo: "Bloqueados", valor: contagens.dados?.bloqueados ?? null, detalhe: "aguardando desbloqueio", icone: "lock", tom: contagens.dados && contagens.dados.bloqueados > 0 ? "perigo" : undefined },
          { rotulo: "Vencidos", valor: contagens.dados?.vencidos ?? null, detalhe: "fora de validade", icone: "alert-triangle", tom: contagens.dados && contagens.dados.vencidos > 0 ? "perigo" : undefined },
        ]}
      />

      <section className="cartao" aria-label="Lista de lotes">
        <div className="barra-de-filtros">
          <CampoDeBusca
            rotulo="Buscar lotes"
            placeholder="Buscar por número do lote…"
            valor={busca}
            tamanhoMaximo={50}
            aoBuscar={(texto) => {
              setBusca(texto);
              setPagina(1);
            }}
          />
          <div className="campo-etiqueta">
            <Icone nome="scan" />
            <input
              type="text"
              aria-label="Buscar lote pela etiqueta"
              placeholder="Ler ou digitar etiqueta…"
              maxLength={128}
              autoComplete="off"
              spellCheck={false}
              onKeyDown={(evento) => {
                if (evento.key !== "Enter") return;
                evento.preventDefault();
                const campo = evento.currentTarget;
                void procurarPorEtiqueta(campo.value).then(() => {
                  campo.value = "";
                });
              }}
            />
          </div>
          <FiltrosRapidos
            rotulo="Status do lote"
            opcoes={opcoes}
            valor={status}
            aoMudar={(valor) => {
              setStatus(valor);
              setPagina(1);
            }}
          />
          <SeletorComBusca
            semRotulo
            rotulo="Filtrar por produto"
            placeholder="Todos os produtos"
            valor={idProduto}
            aoMudar={(valor) => {
              setIdProduto(valor);
              setPagina(1);
            }}
            buscar={(texto, sinal) => buscarProdutosParaSeletor(cliente, texto, sinal, false)}
          />
          <SeletorComBusca
            semRotulo
            rotulo="Filtrar por localização"
            placeholder="Todas as localizações"
            valor={idLocalizacao}
            aoMudar={(valor) => {
              setIdLocalizacao(valor);
              setPagina(1);
            }}
            buscar={(texto, sinal) => buscarLocalizacoesParaSeletor(cliente, texto, sinal)}
          />
          {filtrosAtivos ? (
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={() => {
                setBusca("");
                setStatus("todos");
                setIdProduto("");
                setIdLocalizacao("");
                setPagina(1);
              }}
            >
              <Icone nome="x" />
              Limpar filtros
            </button>
          ) : null}
        </div>
        <Tabela
          rotulo="Lotes"
          colunas={colunas}
          linhas={linhas}
          chave={(lote) => lote.id_lote}
          carregando={lista.carregando}
          erro={lista.erro}
          aoTentarNovamente={lista.recarregar}
          vazio={{
            titulo: filtrosAtivos ? "Nenhum lote corresponde aos filtros" : "Nenhum lote cadastrado",
            descricao: filtrosAtivos ? "Revise os filtros ou limpe-os." : "Registre um lote para começar.",
          }}
          selecionada={(lote) => painel?.tipo === "ver" && painel.lote.id_lote === lote.id_lote}
          colunaDeAcoes={(lote) => <MenuDeAcoes rotulo={`Ações do lote ${lote.numero_lote}`} itens={itensDoMenu(lote)} />}
        />
        {lista.dados ? <Paginacao pagina={lista.dados.pagina} limite={lista.dados.limite} total={lista.dados.total} carregando={lista.carregando} aoMudar={setPagina} /> : null}
      </section>

      {painel?.tipo === "ver" ? (
        <DetalhesDoLote
          lote={painel.lote}
          aoFechar={() => setPainel(null)}
          aoBloquear={() => setParaBloquear(painel.lote)}
          aoAssociarEtiqueta={() => setParaEtiquetar(painel.lote)}
          aoDesbloquear={(lote) => {
            void aposAcao(lote.id_lote, "Lote desbloqueado", lote.numero_lote);
          }}
        />
      ) : null}

      {painel?.tipo === "novo" ? (
        <FormularioDeLote
          aoFechar={() => setPainel(null)}
          aoSalvar={(lote) => {
            setPainel(null);
            mostrar("sucesso", "Lote registrado", lote.numero_lote);
            recarregarTudo();
          }}
        />
      ) : null}

      {paraBloquear ? (
        <BloquearLote
          lote={paraBloquear}
          aoCancelar={() => setParaBloquear(null)}
          aoBloquear={(lote) => {
            setParaBloquear(null);
            void aposAcao(lote.id_lote, "Lote bloqueado", lote.numero_lote);
          }}
        />
      ) : null}

      {paraEtiquetar ? (
        <AssociarEtiqueta
          lote={paraEtiquetar}
          aoCancelar={() => setParaEtiquetar(null)}
          aoAssociar={(etiqueta) => {
            const lote = paraEtiquetar;
            setParaEtiquetar(null);
            void aposAcao(lote.id_lote, "Etiqueta associada", `${lote.numero_lote} · ${etiqueta.codigo}`);
          }}
        />
      ) : null}
    </>
  );
}
