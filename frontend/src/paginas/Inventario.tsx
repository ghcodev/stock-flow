import { useEffect, useMemo, useState } from "react";
import { listarContagens } from "../api/inventario.ts";
import type { Contagem, ResultadoDeFinalizacao, StatusDeContagem } from "../api/tipos.ts";
import { useAutenticacao } from "../autenticacao/ContextoDeAutenticacao.tsx";
import { useAvisos } from "../componentes/Avisos.tsx";
import { Badge, type TomDeBadge } from "../componentes/Badge.tsx";
import { CabecalhoDePagina } from "../componentes/CabecalhoDePagina.tsx";
import { FiltrosRapidos, type OpcaoDeFiltro } from "../componentes/FiltrosRapidos.tsx";
import { Icone } from "../componentes/Icone.tsx";
import { MenuDeAcoes, type ItemDeMenu } from "../componentes/MenuDeAcoes.tsx";
import { Paginacao } from "../componentes/Paginacao.tsx";
import { Tabela, type Coluna } from "../componentes/Tabela.tsx";
import { useCarregar } from "../hooks/useCarregar.ts";
import { podeExecutar } from "../sessao/permissoes.ts";
import { formatarDataHoraUtc } from "../util/datas.ts";
import { formatarQuantidade } from "../util/decimal.ts";
import { textoDaDivergencia, tomDaDivergencia } from "../util/inventario.ts";
import { paginaCorrigida } from "../util/paginacao.ts";
import { DecidirContagem, type Decisao } from "./inventario/DecidirContagem.tsx";
import { FormularioDeContagem } from "./inventario/FormularioDeContagem.tsx";
import "../estilos/administracao.css";
import "../estilos/movimentacao.css";

const LIMITE = 20;

const TONS_DE_STATUS: Record<StatusDeContagem, TomDeBadge> = { pendente: "alerta", concluida: "sucesso", cancelada: "neutro" };
const ROTULOS_DE_STATUS: Record<StatusDeContagem, string> = { pendente: "Pendente", concluida: "Concluída", cancelada: "Cancelada" };

function ResultadoDaFinalizacao({ resultado }: { resultado: ResultadoDeFinalizacao }) {
  return (
    <div className="resultado-movimentacao" role="status" aria-live="polite">
      <div className="resultado-movimentacao-titulo">
        <Badge tom="sucesso" ponto>
          Contagem finalizada
        </Badge>
        <span className="celula-secundaria">{resultado.contagem.numero_lote}</span>
      </div>
      {resultado.ajuste ? (
        <div className="resultado-movimentacao-corpo">
          <span>
            Ajuste gerado: {formatarQuantidade(resultado.ajuste.saldo_anterior)} → <strong>{formatarQuantidade(resultado.ajuste.saldo_posterior)}</strong>
          </span>
          <span>Divergência aplicada: {textoDaDivergencia(resultado.divergencia, formatarQuantidade)}</span>
        </div>
      ) : (
        <div className="resultado-movimentacao-corpo">
          <span>Sem divergência: nenhum ajuste foi necessário.</span>
        </div>
      )}
      <div className="resultado-movimentacao-saldo">
        Saldo final do lote: <strong>{formatarQuantidade(resultado.saldo_final)}</strong>
      </div>
    </div>
  );
}

export function Inventario() {
  const { cliente, sessao } = useAutenticacao();
  const { mostrar } = useAvisos();
  const perfil = sessao?.usuario.perfil ?? null;
  const podeDecidir = podeExecutar(perfil, "finalizar_contagem") && podeExecutar(perfil, "cancelar_contagem");
  const [status, setStatus] = useState<StatusDeContagem>("pendente");
  const [pagina, setPagina] = useState(1);
  const [decisao, setDecisao] = useState<Decisao | null>(null);
  const [resultado, setResultado] = useState<ResultadoDeFinalizacao | null>(null);

  const lista = useCarregar((sinal) => listarContagens(cliente, status, pagina, LIMITE, sinal), [cliente, status, pagina]);
  const contagens = useCarregar(
    async (sinal) => {
      const [pendentes, concluidas, canceladas] = await Promise.all([
        listarContagens(cliente, "pendente", 1, 1, sinal),
        listarContagens(cliente, "concluida", 1, 1, sinal),
        listarContagens(cliente, "cancelada", 1, 1, sinal),
      ]);
      return { pendentes: pendentes.total, concluidas: concluidas.total, canceladas: canceladas.total };
    },
    [cliente],
  );

  const totalDaLista = lista.dados?.total;
  const vaziaNaPagina = lista.dados !== null && lista.dados.dados.length === 0;
  useEffect(() => {
    if (totalDaLista === undefined || !vaziaNaPagina || pagina <= 1) return;
    const valida = paginaCorrigida(pagina, totalDaLista, LIMITE);
    if (valida !== pagina) setPagina(valida);
  }, [totalDaLista, vaziaNaPagina, pagina]);

  const recarregarTudo = () => {
    lista.recarregar();
    contagens.recarregar();
  };

  const colunas = useMemo<Coluna<Contagem>[]>(
    () => [
      { id: "data", titulo: "Data e hora (UTC)", render: (c) => formatarDataHoraUtc(c.data_movimentacao) },
      { id: "lote", titulo: "Lote", mono: true, render: (c) => c.numero_lote },
      { id: "saldo", titulo: "Saldo na contagem", alinhar: "num", render: (c) => formatarQuantidade(c.saldo_anterior) },
      { id: "contado", titulo: "Contado", alinhar: "num", render: (c) => formatarQuantidade(c.quantidade) },
      {
        id: "divergencia",
        titulo: "Divergência",
        alinhar: "num",
        render: (c) => {
          const tom = tomDaDivergencia(c.divergencia);
          return <span className={tom === "zero" ? undefined : tom === "falta" ? "celula-validade--perigo" : "celula-validade--alerta"}>{textoDaDivergencia(c.divergencia, formatarQuantidade)}</span>;
        },
      },
      { id: "usuario", titulo: "Usuário", render: (c) => <span className="celula-truncada">{c.nome_usuario}</span> },
      {
        id: "status",
        titulo: "Situação",
        alinhar: "centro",
        render: (c) => (
          <Badge tom={TONS_DE_STATUS[c.status_movimentacao as StatusDeContagem] ?? "neutro"} ponto>
            {ROTULOS_DE_STATUS[c.status_movimentacao as StatusDeContagem] ?? c.status_movimentacao}
          </Badge>
        ),
      },
    ],
    [],
  );

  const opcoes: OpcaoDeFiltro<StatusDeContagem>[] = [
    { valor: "pendente", rotulo: "Pendentes", contagem: contagens.dados?.pendentes ?? null },
    { valor: "concluida", rotulo: "Concluídas", contagem: contagens.dados?.concluidas ?? null },
    { valor: "cancelada", rotulo: "Canceladas", contagem: contagens.dados?.canceladas ?? null },
  ];

  const itensDoMenu = (contagem: Contagem): ItemDeMenu[] =>
    podeDecidir && contagem.status_movimentacao === "pendente"
      ? [
          { rotulo: "Finalizar", icone: "check", aoSelecionar: () => setDecisao({ modo: "finalizar", contagem }) },
          { rotulo: "Cancelar contagem", icone: "x", perigo: true, aoSelecionar: () => setDecisao({ modo: "cancelar", contagem }) },
        ]
      : [];

  return (
    <>
      <CabecalhoDePagina
        titulo="Inventário rotativo"
        resumo={[
          { texto: contagens.dados ? <><strong>{contagens.dados.pendentes}</strong> contagem(ns) pendente(s)</> : "Carregando…", tom: contagens.dados && contagens.dados.pendentes > 0 ? "alerta" : undefined },
          { texto: podeDecidir ? "Você pode finalizar e cancelar contagens" : "Finalizar e cancelar são do administrador" },
        ]}
        acoes={
          <button type="button" className="btn btn-outline btn-sm" onClick={recarregarTudo} disabled={lista.carregando}>
            <Icone nome="refresh" />
            Atualizar
          </button>
        }
      />

      <div className="movimentacao-grade">
        <FormularioDeContagem
          aoRegistrar={(numero) => {
            mostrar("sucesso", "Contagem registrada", `${numero}: pendente de finalização`);
            setStatus("pendente");
            setPagina(1);
            recarregarTudo();
          }}
          aoResultadoIncerto={recarregarTudo}
        />
        <div className="inventario-lado">
          {resultado ? <ResultadoDaFinalizacao resultado={resultado} /> : null}
          <section className="cartao" aria-label="Contagens">
            <div className="barra-de-filtros">
              <FiltrosRapidos
                rotulo="Situação da contagem"
                opcoes={opcoes}
                valor={status}
                aoMudar={(valor) => {
                  setStatus(valor);
                  setPagina(1);
                }}
              />
            </div>
            <Tabela
              rotulo="Contagens de inventário"
              colunas={colunas}
              linhas={lista.dados?.dados ?? []}
              chave={(contagem) => contagem.id_movimentacao}
              carregando={lista.carregando}
              erro={lista.erro}
              aoTentarNovamente={lista.recarregar}
              vazio={{ titulo: "Nenhuma contagem nesta situação", descricao: status === "pendente" ? "Registre uma contagem ao lado." : "Ainda não há contagens nesta situação." }}
              colunaDeAcoes={(contagem) => {
                const itens = itensDoMenu(contagem);
                return itens.length > 0 ? <MenuDeAcoes rotulo={`Ações da contagem do lote ${contagem.numero_lote}`} itens={itens} /> : null;
              }}
            />
            {lista.dados ? <Paginacao pagina={lista.dados.pagina} limite={lista.dados.limite} total={lista.dados.total} carregando={lista.carregando} aoMudar={setPagina} /> : null}
          </section>
        </div>
      </div>

      {decisao ? (
        <DecidirContagem
          decisao={decisao}
          aoCancelar={() => setDecisao(null)}
          aoAtualizarLista={recarregarTudo}
          aoFinalizar={(retorno) => {
            setDecisao(null);
            setResultado(retorno);
            mostrar("sucesso", "Contagem finalizada", `${retorno.contagem.numero_lote}: saldo final ${formatarQuantidade(retorno.saldo_final)}`);
            recarregarTudo();
          }}
          aoCancelada={(contagem) => {
            setDecisao(null);
            mostrar("sucesso", "Contagem cancelada", contagem.numero_lote);
            recarregarTudo();
          }}
        />
      ) : null}
    </>
  );
}
