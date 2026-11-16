import { Fragment, useMemo, useState, type FormEvent } from "react";
import { buscarUsuariosParaSeletor, listarAuditoria } from "../api/analise.ts";
import type { RegistroDeAuditoria } from "../api/tipos.ts";
import { useAutenticacao } from "../autenticacao/ContextoDeAutenticacao.tsx";
import { Badge, type TomDeBadge } from "../componentes/Badge.tsx";
import { CabecalhoDePagina } from "../componentes/CabecalhoDePagina.tsx";
import { CampoDeAreaDeTexto, CampoDeSelecao, CampoDeTexto } from "../componentes/Campo.tsx";
import { CarregarMais } from "../componentes/CarregarMais.tsx";
import { EstadoDeErro, EstadoVazio } from "../componentes/Estados.tsx";
import { Icone } from "../componentes/Icone.tsx";
import { SeletorComBusca } from "../componentes/SeletorComBusca.tsx";
import { useListaComCursor } from "../hooks/useListaComCursor.ts";
import {
  FILTROS_DE_AUDITORIA_VAZIOS,
  chaveDosFiltros,
  chavesAlteradas,
  consultaDeAuditoria,
  textoDoJson,
  validarFiltrosDeAuditoria,
  type ErrosDeAuditoria,
  type FiltrosDeAuditoria,
} from "../util/auditoria.ts";
import { formatarDataHora } from "../util/datas.ts";
import "../estilos/analise.css";

const TONS: Record<string, TomDeBadge> = { INSERT: "sucesso", UPDATE: "info", DELETE: "perigo" };
const ROTULOS_DE_OPERACAO: Record<string, string> = { INSERT: "Inclusão", UPDATE: "Alteração", DELETE: "Exclusão" };
const ROTULOS_DE_TABELA: Record<string, string> = { lote: "Lote", movimentacao: "Movimentação", usuario: "Usuário" };

function LinhaExpandida({ registro }: { registro: RegistroDeAuditoria }) {
  const alteradas = chavesAlteradas(registro.valor_anterior, registro.valor_novo);
  return (
    <div className="auditoria-detalhe">
      {registro.observacao ? <p className="auditoria-observacao">{registro.observacao}</p> : null}
      {alteradas.length > 0 ? (
        <p className="auditoria-alteradas">
          Campos diferentes:{" "}
          {alteradas.map((chave) => (
            <code key={chave} className="auditoria-chave">
              {chave}
            </code>
          ))}
        </p>
      ) : null}
      <div className="auditoria-lado-a-lado">
        <div>
          <h3>Valor anterior</h3>
          <pre className="auditoria-json">{textoDoJson(registro.valor_anterior)}</pre>
        </div>
        <div>
          <h3>Valor novo</h3>
          <pre className="auditoria-json">{textoDoJson(registro.valor_novo)}</pre>
        </div>
      </div>
    </div>
  );
}

export function Auditoria() {
  const { cliente } = useAutenticacao();
  const [rascunho, setRascunho] = useState<FiltrosDeAuditoria>(FILTROS_DE_AUDITORIA_VAZIOS);
  const [aplicados, setAplicados] = useState<FiltrosDeAuditoria>(FILTROS_DE_AUDITORIA_VAZIOS);
  const [erros, setErros] = useState<ErrosDeAuditoria>({});
  const [chaveDoSeletor, setChaveDoSeletor] = useState(0);
  const [expandidos, setExpandidos] = useState<ReadonlySet<string>>(new Set());

  const consulta = useMemo(() => consultaDeAuditoria(aplicados), [aplicados]);
  const lista = useListaComCursor((cursor, sinal) => listarAuditoria(cliente, consulta, cursor, sinal), chaveDosFiltros(consulta));

  const alterar = (parcial: Partial<FiltrosDeAuditoria>) => {
    setRascunho((atuais) => ({ ...atuais, ...parcial }));
    setErros((atuais) => {
      const restante: ErrosDeAuditoria = { ...atuais };
      for (const chave of Object.keys(parcial) as (keyof FiltrosDeAuditoria)[]) delete restante[chave];
      return restante;
    });
  };

  const aplicar = (evento: FormEvent<HTMLFormElement>) => {
    evento.preventDefault();
    const invalidos = validarFiltrosDeAuditoria(rascunho);
    setErros(invalidos);
    if (Object.keys(invalidos).length > 0) return;
    setExpandidos(new Set());
    if (chaveDosFiltros(consultaDeAuditoria(rascunho)) === chaveDosFiltros(consulta)) lista.recarregar();
    setAplicados(rascunho);
  };

  const limpar = () => {
    setRascunho(FILTROS_DE_AUDITORIA_VAZIOS);
    setAplicados(FILTROS_DE_AUDITORIA_VAZIOS);
    setErros({});
    setExpandidos(new Set());
    setChaveDoSeletor((atual) => atual + 1);
  };

  const alternar = (id: string) =>
    setExpandidos((atuais) => {
      const novo = new Set(atuais);
      if (novo.has(id)) novo.delete(id);
      else novo.add(id);
      return novo;
    });

  const temFiltros = chaveDosFiltros(consultaDeAuditoria(rascunho)) !== chaveDosFiltros(consultaDeAuditoria(FILTROS_DE_AUDITORIA_VAZIOS));
  const primeiraCarga = lista.carregando && lista.itens.length === 0;

  return (
    <>
      <CabecalhoDePagina
        titulo="Auditoria de operações"
        resumo={[{ texto: lista.total !== null ? `${lista.total} registro(s) com os filtros aplicados` : "Carregando…" }, { texto: "Somente leitura, mais recentes primeiro. Datas em UTC." }]}
        acoes={
          <button type="button" className="btn btn-outline btn-sm" onClick={lista.recarregar} disabled={lista.carregando}>
            <Icone nome="refresh" />
            Atualizar
          </button>
        }
      />

      <section className="cartao" aria-label="Registros de auditoria">
        <form className="auditoria-filtros" onSubmit={aplicar} noValidate>
          <div className="campo">
            <span className="form-label">Usuário</span>
            <SeletorComBusca
              key={chaveDoSeletor}
              semRotulo
              rotulo="Filtrar por usuário"
              placeholder="Nome ou e-mail"
              valor={rascunho.idUsuario}
              aoMudar={(valor) => alterar({ idUsuario: valor })}
              buscar={(texto, sinal) => buscarUsuariosParaSeletor(cliente, texto, sinal)}
              erro={erros.idUsuario}
            />
          </div>
          <CampoDeSelecao
            rotulo="Tabela"
            valor={rascunho.tabela}
            aoMudar={(valor) => alterar({ tabela: valor })}
            vazio="Todas"
            opcoes={Object.entries(ROTULOS_DE_TABELA).map(([valor, rotulo]) => ({ valor, rotulo }))}
          />
          <CampoDeSelecao
            rotulo="Operação"
            valor={rascunho.operacao}
            aoMudar={(valor) => alterar({ operacao: valor })}
            vazio="Todas"
            opcoes={Object.entries(ROTULOS_DE_OPERACAO).map(([valor, rotulo]) => ({ valor, rotulo }))}
          />
          <CampoDeTexto rotulo="IP" valor={rascunho.ip} aoMudar={(valor) => alterar({ ip: valor })} erro={erros.ip} tamanhoMaximo={45} placeholder="Ex.: 10.0.0.5" />
          <CampoDeTexto tipo="date" rotulo="De" valor={rascunho.de} aoMudar={(valor) => alterar({ de: valor })} erro={erros.de} />
          <CampoDeTexto tipo="date" rotulo="Até" valor={rascunho.ate} aoMudar={(valor) => alterar({ ate: valor })} erro={erros.ate} />
          <CampoDeAreaDeTexto
            largo
            linhas={2}
            rotulo="Conteúdo novo contém (JSON)"
            valor={rascunho.valorNovo}
            aoMudar={(valor) => alterar({ valorNovo: valor })}
            erro={erros.valorNovo}
            tamanhoMaximo={512}
          />
          <CampoDeAreaDeTexto
            largo
            linhas={2}
            rotulo="Conteúdo anterior contém (JSON)"
            valor={rascunho.valorAnterior}
            aoMudar={(valor) => alterar({ valorAnterior: valor })}
            erro={erros.valorAnterior}
            tamanhoMaximo={512}
          />
          <div className="auditoria-filtros-acoes">
            <button type="submit" className="btn btn-primary btn-sm">
              <Icone nome="filter" />
              Aplicar filtros
            </button>
            {temFiltros || chaveDosFiltros(consulta) !== "[]" ? (
              <button type="button" className="btn btn-outline btn-sm" onClick={limpar}>
                <Icone nome="x" />
                Limpar
              </button>
            ) : null}
          </div>
        </form>

        {lista.erro && lista.itens.length === 0 ? (
          <EstadoDeErro mensagem={lista.erro} aoTentarNovamente={lista.recarregar} />
        ) : primeiraCarga ? (
          <div className="grafico-carregando">
            <span className="esqueleto" />
          </div>
        ) : lista.itens.length === 0 ? (
          <EstadoVazio titulo="Nenhum registro encontrado" descricao="Revise ou limpe os filtros." />
        ) : (
          <div className="tabela-rolagem">
            <table className="tabela" aria-label="Registros de auditoria">
              <thead>
                <tr>
                  <th scope="col">
                    <span className="sr-only">Detalhes</span>
                  </th>
                  <th scope="col">Data e hora (UTC)</th>
                  <th scope="col">Operação</th>
                  <th scope="col">Tabela</th>
                  <th scope="col">Usuário</th>
                  <th scope="col">IP</th>
                </tr>
              </thead>
              <tbody>
                {lista.itens.map((registro) => {
                  const aberto = expandidos.has(registro.id_log);
                  return (
                    <Fragment key={registro.id_log}>
                      <tr aria-selected={aberto ? true : undefined}>
                        <td className="acoes">
                          <button type="button" className="icon-btn" onClick={() => alternar(registro.id_log)} aria-expanded={aberto} aria-controls={`detalhe-${registro.id_log}`} aria-label={`${aberto ? "Recolher" : "Expandir"} o registro ${registro.id_log}`}>
                            <Icone nome={aberto ? "chevron-down" : "chevron-right"} />
                          </button>
                        </td>
                        <td>{formatarDataHora(registro.data_hora)}</td>
                        <td>
                          <Badge tom={TONS[registro.operacao] ?? "neutro"} ponto>
                            {ROTULOS_DE_OPERACAO[registro.operacao] ?? registro.operacao}
                          </Badge>
                        </td>
                        <td>{ROTULOS_DE_TABELA[registro.tabela_afetada] ?? registro.tabela_afetada}</td>
                        <td>{registro.nome_usuario ?? "Sistema"}</td>
                        <td className="mono">{registro.ip_usuario ?? "—"}</td>
                      </tr>
                      {aberto ? (
                        <tr id={`detalhe-${registro.id_log}`} className="auditoria-linha-detalhe">
                          <td colSpan={6}>
                            <LinhaExpandida registro={registro} />
                          </td>
                        </tr>
                      ) : null}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <CarregarMais exibidos={lista.itens.length} total={lista.total} haMais={lista.haMais} carregando={lista.carregando && lista.itens.length > 0} erro={lista.erro} aoCarregarMais={lista.carregarMais} />
      </section>
    </>
  );
}
