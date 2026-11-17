import type { CSSProperties } from "react";
import { useId } from "react";
import { formatarInteiro } from "../../util/decimal.ts";
import { formatarDia } from "../../util/datas.ts";
import { marcasDoEixo, maximoDaEscala, ROTULOS_DOS_TIPOS, TIPOS_DO_GRAFICO, resumirDias, type DiaDoGrafico } from "../../util/grafico.ts";

const LARGURA = 720;
const ALTURA = 260;
const MARGEM = { esquerda: 44, direita: 8, topo: 12, base: 28 };
const LARGURA_UTIL = LARGURA - MARGEM.esquerda - MARGEM.direita;
const ALTURA_UTIL = ALTURA - MARGEM.topo - MARGEM.base;

function rotuloCurto(dia: string): string {
  return formatarDia(dia).slice(0, 5);
}

export function GraficoDeMovimentacoes({ dias }: { dias: readonly DiaDoGrafico[] }) {
  const idTitulo = useId();
  const idDescricao = useId();
  const resumo = resumirDias(dias);
  const escala = maximoDaEscala(resumo.maximoDiario);
  const marcas = marcasDoEixo(escala);
  const passo = LARGURA_UTIL / Math.max(1, dias.length);
  const larguraDaBarra = Math.max(4, passo * 0.64);
  const y = (valor: number) => MARGEM.topo + ALTURA_UTIL - (valor / escala) * ALTURA_UTIL;

  const descricao =
    resumo.diaDePico === null
      ? "Nenhuma movimentação concluída no período."
      : `${formatarInteiro(resumo.total)} movimentações concluídas em ${dias.length} dias. Maior dia: ${formatarDia(resumo.diaDePico)} com ${formatarInteiro(resumo.maximoDiario)}.`;

  return (
    <div className="grafico">
      <svg className="grafico-svg" viewBox={`0 0 ${LARGURA} ${ALTURA}`} role="img" aria-labelledby={`${idTitulo} ${idDescricao}`} preserveAspectRatio="xMidYMid meet">
        <title id={idTitulo}>Movimentações concluídas por dia e por tipo, últimos {dias.length} dias</title>
        <desc id={idDescricao}>{descricao}</desc>
        {marcas.map((marca) => (
          <g key={marca}>
            <line className="grafico-grade" x1={MARGEM.esquerda} x2={LARGURA - MARGEM.direita} y1={y(marca)} y2={y(marca)} />
            <text className="grafico-rotulo" x={MARGEM.esquerda - 6} y={y(marca) + 4} textAnchor="end">
              {formatarInteiro(marca)}
            </text>
          </g>
        ))}
        {dias.map((dia, indice) => {
          const x = MARGEM.esquerda + indice * passo + (passo - larguraDaBarra) / 2;
          let acumulado = 0;
          return (
            <g key={dia.dia} style={{ "--i": indice } as CSSProperties}>
              {TIPOS_DO_GRAFICO.map((tipo) => {
                const valor = dia.valores[tipo];
                if (valor === 0) return null;
                const topo = y(acumulado + valor);
                const altura = y(acumulado) - topo;
                acumulado += valor;
                return (
                  <rect key={tipo} className={`grafico-barra grafico-barra--${tipo}`} x={x} y={topo} width={larguraDaBarra} height={altura}>
                    <title>{`${formatarDia(dia.dia)} · ${ROTULOS_DOS_TIPOS[tipo]}: ${formatarInteiro(valor)}`}</title>
                  </rect>
                );
              })}
              {indice % 5 === 0 || indice === dias.length - 1 ? (
                <text className="grafico-rotulo" x={x + larguraDaBarra / 2} y={ALTURA - 8} textAnchor="middle">
                  {rotuloCurto(dia.dia)}
                </text>
              ) : null}
            </g>
          );
        })}
      </svg>
      <ul className="grafico-legenda" aria-label="Legenda dos tipos">
        {TIPOS_DO_GRAFICO.map((tipo) => (
          <li key={tipo}>
            <span className={`grafico-amostra grafico-barra--${tipo}`} aria-hidden="true" />
            {ROTULOS_DOS_TIPOS[tipo]}
          </li>
        ))}
      </ul>
      <details className="grafico-tabela">
        <summary>Ver os dados do gráfico em tabela</summary>
        <div className="tabela-rolagem">
          <table className="tabela tabela--compacta">
            <caption className="sr-only">Movimentações concluídas por dia e por tipo</caption>
            <thead>
              <tr>
                <th scope="col">Dia</th>
                {TIPOS_DO_GRAFICO.map((tipo) => (
                  <th key={tipo} scope="col" className="num">
                    {ROTULOS_DOS_TIPOS[tipo]}
                  </th>
                ))}
                <th scope="col" className="num">
                  Total
                </th>
              </tr>
            </thead>
            <tbody>
              {dias.map((dia) => (
                <tr key={dia.dia}>
                  <th scope="row">{formatarDia(dia.dia)}</th>
                  {TIPOS_DO_GRAFICO.map((tipo) => (
                    <td key={tipo} className="num">
                      {formatarInteiro(dia.valores[tipo])}
                    </td>
                  ))}
                  <td className="num">{formatarInteiro(dia.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
