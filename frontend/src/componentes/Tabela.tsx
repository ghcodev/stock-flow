import { useMemo, useState, type ReactNode } from "react";
import { ordenarLinhas, proximaOrdenacao, type Ordenacao } from "../util/ordenacao.ts";
import { EstadoDeErro, EstadoVazio } from "./Estados.tsx";
import { Icone } from "./Icone.tsx";

export type Coluna<T> = {
  id: string;
  titulo: string;
  render: (linha: T) => ReactNode;
  comparar?: (a: T, b: T) => number;
  alinhar?: "num" | "centro";
  mono?: boolean;
};

type Propriedades<T> = {
  rotulo: string;
  colunas: Coluna<T>[];
  linhas: readonly T[];
  chave: (linha: T) => string | number;
  carregando: boolean;
  erro: string | null;
  aoTentarNovamente: () => void;
  vazio: { titulo: string; descricao?: string };
  selecionada?: ((linha: T) => boolean) | undefined;
  colunaDeAcoes?: ((linha: T) => ReactNode) | undefined;
};

const LINHAS_DO_ESQUELETO = 6;

function descricaoDoSentido(ordenacao: Ordenacao | null, coluna: string): "ascending" | "descending" | "none" {
  if (ordenacao === null || ordenacao.coluna !== coluna) return "none";
  return ordenacao.direcao === "asc" ? "ascending" : "descending";
}

function iconeDoSentido(ordenacao: Ordenacao | null, coluna: string): string {
  if (ordenacao === null || ordenacao.coluna !== coluna) return "arrow-up-down";
  return ordenacao.direcao === "asc" ? "arrow-up" : "arrow-down";
}

export function Tabela<T>({
  rotulo,
  colunas,
  linhas,
  chave,
  carregando,
  erro,
  aoTentarNovamente,
  vazio,
  selecionada,
  colunaDeAcoes,
}: Propriedades<T>) {
  const [ordenacao, setOrdenacao] = useState<Ordenacao | null>(null);

  const visiveis = useMemo(() => {
    const coluna = colunas.find((c) => c.id === ordenacao?.coluna);
    return ordenarLinhas(linhas, coluna?.comparar ?? null, ordenacao?.direcao ?? "asc");
  }, [linhas, colunas, ordenacao]);

  const totalDeColunas = colunas.length + (colunaDeAcoes ? 1 : 0);
  const primeiraCarga = carregando && linhas.length === 0 && erro === null;

  return (
    <>
      {erro !== null && linhas.length > 0 ? (
        <div className="tabela-erro" role="alert">
          <Icone nome="alert-triangle" />
          <span>{erro}</span>
          <button type="button" className="btn btn-outline btn-sm" onClick={aoTentarNovamente}>
            Tentar novamente
          </button>
        </div>
      ) : null}
    <div className="tabela-rolagem">
      <table className={carregando && !primeiraCarga ? "tabela tabela--ocupada" : "tabela"} aria-label={rotulo} aria-busy={carregando}>
        <thead>
          <tr>
            {colunas.map((coluna) => (
              <th
                key={coluna.id}
                scope="col"
                className={coluna.alinhar}
                aria-sort={coluna.comparar ? descricaoDoSentido(ordenacao, coluna.id) : undefined}
              >
                {coluna.comparar ? (
                  <button type="button" onClick={() => setOrdenacao((atual) => proximaOrdenacao(atual, coluna.id))}>
                    {coluna.titulo}
                    <Icone nome={iconeDoSentido(ordenacao, coluna.id)} />
                  </button>
                ) : (
                  coluna.titulo
                )}
              </th>
            ))}
            {colunaDeAcoes ? (
              <th scope="col" className="acoes">
                <span className="sr-only">Ações</span>
              </th>
            ) : null}
          </tr>
        </thead>
        <tbody>
          {primeiraCarga
            ? Array.from({ length: LINHAS_DO_ESQUELETO }, (_, indice) => (
                <tr key={indice} aria-hidden="true">
                  {Array.from({ length: totalDeColunas }, (_celula, coluna) => (
                    <td key={coluna}>
                      <span className="esqueleto" />
                    </td>
                  ))}
                </tr>
              ))
            : null}
          {erro !== null && linhas.length === 0 ? (
            <tr>
              <td colSpan={totalDeColunas}>
                <EstadoDeErro mensagem={erro} aoTentarNovamente={aoTentarNovamente} />
              </td>
            </tr>
          ) : null}
          {!carregando && erro === null && linhas.length === 0 ? (
            <tr>
              <td colSpan={totalDeColunas}>
                <EstadoVazio titulo={vazio.titulo} descricao={vazio.descricao} />
              </td>
            </tr>
          ) : null}
          {visiveis.map((linha) => (
            <tr key={chave(linha)} aria-selected={selecionada?.(linha) ? true : undefined}>
              {colunas.map((coluna) => {
                const classes = [coluna.alinhar, coluna.mono ? "mono" : undefined].filter((c) => c !== undefined).join(" ");
                return (
                  <td key={coluna.id} className={classes === "" ? undefined : classes}>
                    {coluna.render(linha)}
                  </td>
                );
              })}
              {colunaDeAcoes ? <td className="acoes">{colunaDeAcoes(linha)}</td> : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
    </>
  );
}
