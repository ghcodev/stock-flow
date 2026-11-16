import { useMemo, useState } from "react";
import { buscarLotesParaSeletor } from "../api/buscas.ts";
import { buscarUsuariosParaSeletor, listarHistorico } from "../api/analise.ts";
import type { MovimentacaoDoHistorico, TipoMovimentacao } from "../api/tipos.ts";
import { useAutenticacao } from "../autenticacao/ContextoDeAutenticacao.tsx";
import { Badge, type TomDeBadge } from "../componentes/Badge.tsx";
import { CabecalhoDePagina } from "../componentes/CabecalhoDePagina.tsx";
import { CarregarMais } from "../componentes/CarregarMais.tsx";
import { Icone } from "../componentes/Icone.tsx";
import { SeletorComBusca } from "../componentes/SeletorComBusca.tsx";
import { Tabela, type Coluna } from "../componentes/Tabela.tsx";
import { useListaComCursor } from "../hooks/useListaComCursor.ts";
import { podeAcessar } from "../sessao/permissoes.ts";
import { chaveDosFiltros, validarPeriodo } from "../util/auditoria.ts";
import { formatarDataHoraUtc } from "../util/datas.ts";
import { formatarQuantidade } from "../util/decimal.ts";
import { ROTULOS_DOS_TIPOS } from "../util/grafico.ts";
import "../estilos/analise.css";

const TONS: Record<TipoMovimentacao, TomDeBadge> = { entrada: "sucesso", saida: "perigo", transferencia: "info", ajuste: "alerta", inventario: "admin" };
const TIPOS: TipoMovimentacao[] = ["entrada", "saida", "transferencia", "ajuste", "inventario"];

type Filtros = { tipo: string; de: string; ate: string; idLote: string; idUsuario: string; minhas: boolean };
const VAZIOS: Filtros = { tipo: "", de: "", ate: "", idLote: "", idUsuario: "", minhas: false };

export function Historico() {
  const { cliente, sessao } = useAutenticacao();
  const administrador = sessao !== null && podeAcessar(sessao.usuario.perfil, "usuarios");
  const [filtros, setFiltros] = useState<Filtros>(VAZIOS);
  const [chaveDosSeletores, setChaveDosSeletores] = useState(0);
  const erroDePeriodo = validarPeriodo(filtros.de, filtros.ate);
  const periodoOk = erroDePeriodo.de === undefined && erroDePeriodo.ate === undefined;

  const consulta = useMemo(
    () => ({
      tipo: filtros.tipo,
      de: periodoOk ? filtros.de : "",
      ate: periodoOk ? filtros.ate : "",
      id_lote: filtros.idLote === "" ? undefined : Number(filtros.idLote),
      id_usuario: filtros.minhas && sessao ? sessao.usuario.id_usuario : filtros.idUsuario === "" ? undefined : Number(filtros.idUsuario),
    }),
    [filtros, periodoOk, sessao],
  );

  const lista = useListaComCursor((cursor, sinal) => listarHistorico(cliente, consulta, cursor, sinal), chaveDosFiltros(consulta));

  const colunas = useMemo<Coluna<MovimentacaoDoHistorico>[]>(
    () => [
      { id: "data", titulo: "Data e hora (UTC)", render: (m) => formatarDataHoraUtc(m.data_movimentacao) },
      {
        id: "tipo",
        titulo: "Tipo",
        render: (m) => (
          <Badge tom={TONS[m.tipo_movimentacao]} ponto>
            {ROTULOS_DOS_TIPOS[m.tipo_movimentacao]}
          </Badge>
        ),
      },
      { id: "lote", titulo: "Lote", mono: true, render: (m) => m.numero_lote },
      { id: "quantidade", titulo: "Quantidade", alinhar: "num", render: (m) => formatarQuantidade(m.quantidade) },
      {
        id: "saldo",
        titulo: "Saldo",
        alinhar: "num",
        render: (m) => (m.tipo_movimentacao === "inventario" ? "—" : `${formatarQuantidade(m.saldo_anterior)} → ${formatarQuantidade(m.saldo_posterior)}`),
      },
      { id: "usuario", titulo: "Usuário", render: (m) => <span className="celula-truncada">{m.nome_usuario}</span> },
      {
        id: "status",
        titulo: "Status",
        alinhar: "centro",
        render: (m) => <Badge tom={m.status_movimentacao === "concluida" ? "sucesso" : m.status_movimentacao === "pendente" ? "alerta" : "neutro"}>{m.status_movimentacao === "concluida" ? "Concluída" : m.status_movimentacao === "pendente" ? "Pendente" : "Cancelada"}</Badge>,
      },
      { id: "motivo", titulo: "Motivo", render: (m) => <span className="celula-truncada">{m.motivo_movimentacao ?? "—"}</span> },
    ],
    [],
  );

  const alterar = (parcial: Partial<Filtros>) => setFiltros((atuais) => ({ ...atuais, ...parcial }));
  const filtrosAtivos = JSON.stringify(filtros) !== JSON.stringify(VAZIOS);

  return (
    <>
      <CabecalhoDePagina
        titulo="Histórico de movimentações"
        resumo={[{ texto: lista.total !== null ? `${lista.total} registro(s) com os filtros atuais` : "Carregando…" }, { texto: "Mais recentes primeiro. Horários e período em UTC." }]}
        acoes={
          <button type="button" className="btn btn-outline btn-sm" onClick={lista.recarregar} disabled={lista.carregando}>
            <Icone nome="refresh" />
            Atualizar
          </button>
        }
      />

      <section className="cartao" aria-label="Histórico">
        <div className="barra-de-filtros barra-de-filtros--analise">
          <label className="filtro-campo">
            <span className="filtro-campo-rotulo">Tipo</span>
            <select className="seletor" value={filtros.tipo} onChange={(e) => alterar({ tipo: e.target.value })}>
              <option value="">Todos os tipos</option>
              {TIPOS.map((tipo) => (
                <option key={tipo} value={tipo}>
                  {ROTULOS_DOS_TIPOS[tipo]}
                </option>
              ))}
            </select>
          </label>
          <label className="filtro-campo">
            <span className="filtro-campo-rotulo">De</span>
            <input type="date" className="seletor" value={filtros.de} onChange={(e) => alterar({ de: e.target.value })} aria-invalid={erroDePeriodo.de !== undefined} />
          </label>
          <label className="filtro-campo">
            <span className="filtro-campo-rotulo">Até</span>
            <input type="date" className="seletor" value={filtros.ate} onChange={(e) => alterar({ ate: e.target.value })} aria-invalid={erroDePeriodo.ate !== undefined} />
          </label>
          <div className="filtro-campo filtro-campo--seletor">
            <span className="filtro-campo-rotulo">Lote</span>
            <SeletorComBusca
              key={`lote-${chaveDosSeletores}`}
              semRotulo
              rotulo="Filtrar por lote"
              placeholder="Número do lote"
              valor={filtros.idLote}
              aoMudar={(valor) => alterar({ idLote: valor })}
              buscar={async (texto, sinal) => (await buscarLotesParaSeletor(cliente, texto, sinal)).map((item) => item.opcao)}
            />
          </div>
          {administrador ? (
            <div className="filtro-campo filtro-campo--seletor">
              <span className="filtro-campo-rotulo">Usuário</span>
              <SeletorComBusca
                key={`usuario-${chaveDosSeletores}`}
                semRotulo
                rotulo="Filtrar por usuário"
                placeholder="Nome ou e-mail"
                valor={filtros.idUsuario}
                desabilitado={filtros.minhas}
                aoMudar={(valor) => alterar({ idUsuario: valor })}
                buscar={(texto, sinal) => buscarUsuariosParaSeletor(cliente, texto, sinal)}
              />
            </div>
          ) : null}
          <button type="button" className="filtro-rapido" aria-pressed={filtros.minhas} onClick={() => alterar({ minhas: !filtros.minhas, idUsuario: "" })}>
            Só as minhas
          </button>
          {filtrosAtivos ? (
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={() => {
                setFiltros(VAZIOS);
                setChaveDosSeletores((atual) => atual + 1);
              }}
            >
              <Icone nome="x" />
              Limpar filtros
            </button>
          ) : null}
        </div>
        {!periodoOk ? (
          <div className="tabela-erro" role="alert">
            <Icone nome="alert-triangle" />
            <span>{erroDePeriodo.de ?? erroDePeriodo.ate} O período não foi aplicado.</span>
          </div>
        ) : null}
        <Tabela
          rotulo="Movimentações"
          colunas={colunas}
          linhas={lista.itens}
          chave={(m) => m.id_movimentacao}
          carregando={lista.carregando && lista.itens.length === 0}
          erro={lista.itens.length === 0 ? lista.erro : null}
          aoTentarNovamente={lista.recarregar}
          vazio={{ titulo: "Nenhuma movimentação encontrada", descricao: filtrosAtivos ? "Revise ou limpe os filtros." : "Ainda não há movimentações registradas." }}
        />
        <CarregarMais exibidos={lista.itens.length} ocultos={lista.ocultos} total={lista.total} haMais={lista.haMais} carregando={lista.carregando && lista.itens.length > 0} erro={lista.erro} aoCarregarMais={lista.carregarMais} aoVoltarAoInicio={lista.recarregar} />
      </section>
    </>
  );
}
