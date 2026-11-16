import { useMemo, type ReactNode } from "react";
import { Link } from "react-router";
import { listarAlertasDeVencimento, obterDashboard } from "../api/dashboard.ts";
import type { AlertaDeEstoqueMinimo, AlertaDeVencimento, Indicadores } from "../api/tipos.ts";
import { useAutenticacao } from "../autenticacao/ContextoDeAutenticacao.tsx";
import { AvisoDeAtualizacao } from "../componentes/AvisoDeAtualizacao.tsx";
import { Badge } from "../componentes/Badge.tsx";
import { CabecalhoDePagina } from "../componentes/CabecalhoDePagina.tsx";
import { EstadoDeErro, EstadoVazio } from "../componentes/Estados.tsx";
import { FaixaDeIndicadores, type Indicador } from "../componentes/FaixaDeIndicadores.tsx";
import { Icone } from "../componentes/Icone.tsx";
import { useCarregar } from "../hooks/useCarregar.ts";
import { useHorarioDoSucesso } from "../hooks/useHorarioDoSucesso.ts";
import { ehDiaValido, formatarDia } from "../util/datas.ts";
import { formatarInteiro, formatarQuantidade, subtrairDecimais } from "../util/decimal.ts";
import { montarDias } from "../util/grafico.ts";
import { GraficoDeMovimentacoes } from "./dashboard/GraficoDeMovimentacoes.tsx";
import { tomDoPrazo } from "./vencimentos/prazo.ts";
import "../estilos/dashboard.css";

const ITENS_DE_VENCIMENTO = 8;

function Bloco({ titulo, subtitulo, acao, children, rotulo }: { titulo: string; subtitulo?: string | undefined; acao?: ReactNode; children: ReactNode; rotulo: string }) {
  return (
    <section className="cartao" aria-label={rotulo}>
      <div className="cartao-cabecalho cartao-cabecalho--linha">
        <div>
          <h2>{titulo}</h2>
          {subtitulo ? <div className="celula-secundaria">{subtitulo}</div> : null}
        </div>
        {acao}
      </div>
      <div className="bloco-corpo">{children}</div>
    </section>
  );
}

function deficit(item: AlertaDeEstoqueMinimo): string {
  return subtrairDecimais(item.estoque_minimo, item.saldo_ativo) ?? "0";
}

function indicadores(dados: Indicadores): Indicador[] {
  return [
    { rotulo: "Produtos ativos", valor: dados.produtos, detalhe: "cadastros que aceitam lotes", icone: "package" },
    { rotulo: "Lotes com saldo", valor: dados.lotes, detalhe: "ativos e com quantidade acima de zero", icone: "layers", tom: "sucesso" },
    { rotulo: "Vencidos", valor: dados.vencidos, detalhe: dados.vencidos > 0 ? "revisar e dar baixa" : "nenhum lote vencido", icone: "clock", tom: dados.vencidos > 0 ? "perigo" : undefined },
    { rotulo: "Bloqueados", valor: dados.bloqueados, detalhe: dados.bloqueados > 0 ? "aguardando decisão" : "nenhum lote bloqueado", icone: "lock", tom: dados.bloqueados > 0 ? "alerta" : undefined },
    { rotulo: "Movimentações hoje", valor: dados.movimentacoes, detalhe: "concluídas no dia", icone: "activity" },
    { rotulo: "Divergências", valor: dados.divergencias, detalhe: dados.divergencias > 0 ? "contagens pendentes com diferença" : "sem contagem divergente", icone: "clipboard", tom: dados.divergencias > 0 ? "perigo" : undefined },
  ];
}

export function Dashboard() {
  const { cliente } = useAutenticacao();
  const painel = useCarregar((sinal) => obterDashboard(cliente, sinal), [cliente]);
  const vencimentos = useCarregar((sinal) => listarAlertasDeVencimento(cliente, 1, ITENS_DE_VENCIMENTO, sinal), [cliente]);

  const dias = useMemo(() => (painel.dados && ehDiaValido(painel.dados.data_referencia) ? montarDias(painel.dados.grafico, painel.dados.data_referencia) : null), [painel.dados]);
  const atualizadoEm = useHorarioDoSucesso(painel.dados);
  const horarioDosVencimentos = useHorarioDoSucesso(vencimentos.dados);
  const falhaDoPainel = painel.erro !== null && painel.dados !== null ? painel.erro : null;
  const falhaDosVencimentos = vencimentos.erro !== null && vencimentos.dados !== null ? vencimentos.erro : null;
  const avisoDoPainel = falhaDoPainel !== null ? <AvisoDeAtualizacao mensagem={falhaDoPainel} horario={atualizadoEm} aoTentarNovamente={painel.recarregar} /> : null;

  const recarregar = () => {
    painel.recarregar();
    vencimentos.recarregar();
  };

  const tiposDeIndicador = painel.dados?.indicadores;
  const faixa: Indicador[] = tiposDeIndicador
    ? indicadores(tiposDeIndicador)
    : ["Produtos ativos", "Lotes com saldo", "Vencidos", "Bloqueados", "Movimentações hoje", "Divergências"].map((rotulo) => ({ rotulo, valor: null, detalhe: painel.erro ? "indisponível" : "carregando…", icone: "activity" }));

  return (
    <>
      <CabecalhoDePagina
        titulo="Visão geral operacional"
        resumo={[{ texto: atualizadoEm ? `Atualizado às ${atualizadoEm}` : "Carregando dados…" }]}
        acoes={
          <button type="button" className="btn btn-outline btn-sm" onClick={recarregar} disabled={painel.carregando || vencimentos.carregando}>
            <Icone nome="refresh" />
            Atualizar
          </button>
        }
      />

      {painel.erro && !painel.dados ? (
        <div className="cartao dashboard-erro">
          <EstadoDeErro mensagem={painel.erro} aoTentarNovamente={painel.recarregar} />
        </div>
      ) : (
        <>
          {avisoDoPainel}
          <FaixaDeIndicadores rotulo="Indicadores principais" itens={faixa} />
        </>
      )}

      <div className="dashboard-grade">
        <Bloco titulo="Movimentações dos últimos 30 dias" subtitulo="Concluídas, por dia e por tipo" rotulo="Gráfico de movimentações">
          {painel.erro && !dias ? (
            <EstadoDeErro mensagem={painel.erro} aoTentarNovamente={painel.recarregar} />
          ) : dias === null ? (
            <div className="grafico-carregando">
              <span className="esqueleto" />
            </div>
          ) : falhaDoPainel !== null ? (
            <>
              {avisoDoPainel}
              {dias.every((d) => d.total === 0) ? <EstadoVazio titulo="Sem movimentações no período" /> : <GraficoDeMovimentacoes dias={dias} />}
            </>
          ) : dias.every((d) => d.total === 0) ? (
            <EstadoVazio titulo="Sem movimentações no período" descricao="Registre entradas, saídas ou transferências para ver o gráfico." />
          ) : (
            <GraficoDeMovimentacoes dias={dias} />
          )}
        </Bloco>

        <Bloco
          titulo="Estoque abaixo do mínimo"
          subtitulo={painel.dados ? `${formatarInteiro(painel.dados.alertas_estoque_minimo.total)} produto(s) em alerta` : undefined}
          rotulo="Alertas de estoque mínimo"
        >
          {painel.erro && !painel.dados ? (
            <EstadoDeErro mensagem={painel.erro} aoTentarNovamente={painel.recarregar} />
          ) : painel.dados === null ? (
            <div className="grafico-carregando">
              <span className="esqueleto" />
            </div>
          ) : painel.dados.alertas_estoque_minimo.itens.length === 0 ? (
            <EstadoVazio titulo="Nenhum produto abaixo do mínimo" descricao="A soma dos lotes ativos cobre o estoque mínimo de todos os produtos." />
          ) : (
            <>
              {avisoDoPainel}
              <div className="tabela-rolagem tabela-rolagem--curta">
                <table className="tabela tabela--compacta" aria-label="Produtos abaixo do estoque mínimo">
                  <thead>
                    <tr>
                      <th scope="col">Produto</th>
                      <th scope="col" className="num">
                        Saldo ativo
                      </th>
                      <th scope="col" className="num">
                        Mínimo
                      </th>
                      <th scope="col" className="num">
                        Falta
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {painel.dados.alertas_estoque_minimo.itens.map((item) => (
                      <tr key={item.id_produto}>
                        <td className="celula-truncada">{item.nome}</td>
                        <td className="num">
                          {formatarQuantidade(item.saldo_ativo)} {item.unidade_medida}
                        </td>
                        <td className="num">{formatarQuantidade(item.estoque_minimo)}</td>
                        <td className="num celula-validade--perigo">{formatarQuantidade(deficit(item))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {painel.dados.alertas_estoque_minimo.total > painel.dados.alertas_estoque_minimo.itens.length ? (
                <p className="bloco-nota">
                  Mostrando {formatarInteiro(painel.dados.alertas_estoque_minimo.itens.length)} de {formatarInteiro(painel.dados.alertas_estoque_minimo.total)} produtos em alerta.
                </p>
              ) : null}
            </>
          )}
        </Bloco>
      </div>

      <Bloco
        titulo="Vencimentos nos próximos 30 dias"
        subtitulo={vencimentos.dados ? `${formatarInteiro(vencimentos.dados.total)} lote(s) ativo(s) a vencer` : undefined}
        rotulo="Alertas de vencimento"
        acao={
          <Link className="btn btn-outline btn-sm" to="/vencimentos">
            Ver todos
            <Icone nome="arrow-right" />
          </Link>
        }
      >
        {vencimentos.erro && !vencimentos.dados ? (
          <EstadoDeErro mensagem={vencimentos.erro} aoTentarNovamente={vencimentos.recarregar} />
        ) : vencimentos.dados === null ? (
          <div className="grafico-carregando">
            <span className="esqueleto" />
          </div>
        ) : vencimentos.dados.dados.length === 0 ? (
          <EstadoVazio titulo="Nenhum lote vence nos próximos 30 dias" descricao="Os lotes ativos com validade na janela aparecem aqui." />
        ) : (
          <>
          {falhaDosVencimentos !== null ? <AvisoDeAtualizacao mensagem={falhaDosVencimentos} horario={horarioDosVencimentos} aoTentarNovamente={vencimentos.recarregar} /> : null}
          <div className="tabela-rolagem tabela-rolagem--curta">
            <table className="tabela tabela--compacta" aria-label="Lotes a vencer">
              <thead>
                <tr>
                  <th scope="col">Lote</th>
                  <th scope="col">Produto</th>
                  <th scope="col">Validade</th>
                  <th scope="col" className="num">
                    Saldo
                  </th>
                </tr>
              </thead>
              <tbody>
                {vencimentos.dados.dados.map((alerta: AlertaDeVencimento) => (
                  <tr key={alerta.id_lote}>
                    <td className="mono">{alerta.numero_lote}</td>
                    <td className="celula-truncada">{alerta.produto}</td>
                    <td>
                      {formatarDia(alerta.data_validade)} <Badge tom={tomDoPrazo(alerta.dias_restantes)}>{alerta.dias_restantes === 0 ? "hoje" : `${alerta.dias_restantes} d`}</Badge>
                    </td>
                    <td className="num">
                      {formatarQuantidade(alerta.quantidade)} {alerta.unidade_medida}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          </>
        )}
      </Bloco>
    </>
  );
}
