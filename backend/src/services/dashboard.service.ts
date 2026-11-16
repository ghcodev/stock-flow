import { prisma } from "../db.ts";
import { Prisma } from "../generated/prisma/client.ts";

export type Escopo = { idsDeProduto: number[] };

export type Indicadores = {
  produtos: number;
  lotes: number;
  vencidos: number;
  bloqueados: number;
  movimentacoes: number;
  divergencias: number;
};

export type PontoDoGrafico = { dia: string; tipo: string; total: number };

export type AlertaDeEstoqueMinimo = {
  id_produto: number;
  nome: string;
  unidade_medida: string;
  estoque_minimo: Prisma.Decimal;
  saldo_ativo: Prisma.Decimal;
};

export type Dashboard = {
  indicadores: Indicadores;
  grafico: PontoDoGrafico[];
  alertas_estoque_minimo: { total: number; itens: AlertaDeEstoqueMinimo[] };
};

const MAX_ALERTAS = 100;
const DIAS_DO_GRAFICO = 30;

function produtoDe(coluna: string, escopo?: Escopo): Prisma.Sql {
  return escopo ? Prisma.sql`AND ${Prisma.raw(coluna)} = ANY(${escopo.idsDeProduto}::int[])` : Prisma.empty;
}

function loteDoEscopo(escopo?: Escopo): Prisma.Sql {
  return escopo
    ? Prisma.sql`AND id_lote IN (SELECT id_lote FROM lote WHERE id_produto = ANY(${escopo.idsDeProduto}::int[]))`
    : Prisma.empty;
}

export async function calcularIndicadores(escopo?: Escopo): Promise<Indicadores> {
  const [linha] = await prisma.$queryRaw<Indicadores[]>`
    SELECT
      (SELECT count(*)::int FROM produto WHERE ativo ${produtoDe("id_produto", escopo)}) AS produtos,
      (SELECT count(*)::int FROM lote WHERE status_lote = 'ativo' AND quantidade > 0 ${produtoDe("id_produto", escopo)}) AS lotes,
      (SELECT count(*)::int FROM lote WHERE status_lote = 'vencido' ${produtoDe("id_produto", escopo)}) AS vencidos,
      (SELECT count(*)::int FROM lote WHERE status_lote = 'bloqueado' ${produtoDe("id_produto", escopo)}) AS bloqueados,
      (SELECT count(*)::int FROM movimentacao
         WHERE status_movimentacao = 'concluida'
           AND data_movimentacao >= current_date::timestamptz
           AND data_movimentacao < (current_date + 1)::timestamptz ${loteDoEscopo(escopo)}) AS movimentacoes,
      (SELECT count(*)::int FROM movimentacao
         WHERE tipo_movimentacao = 'inventario' AND status_movimentacao = 'pendente'
           AND quantidade <> saldo_anterior ${loteDoEscopo(escopo)}) AS divergencias`;
  return linha ?? { produtos: 0, lotes: 0, vencidos: 0, bloqueados: 0, movimentacoes: 0, divergencias: 0 };
}

export function movimentacoesPorDiaETipo(escopo?: Escopo): Promise<PontoDoGrafico[]> {
  return prisma.$queryRaw<PontoDoGrafico[]>`
    SELECT to_char(data_movimentacao::date, 'YYYY-MM-DD') AS dia, tipo_movimentacao::text AS tipo, count(*)::int AS total
    FROM movimentacao
    WHERE status_movimentacao = 'concluida'
      AND data_movimentacao >= (current_date - ${DIAS_DO_GRAFICO - 1}::int)::timestamptz
      AND data_movimentacao < (current_date + 1)::timestamptz ${loteDoEscopo(escopo)}
    GROUP BY 1, 2 ORDER BY 1, 2`;
}

export async function alertasDeEstoqueMinimo(escopo?: Escopo): Promise<Dashboard["alertas_estoque_minimo"]> {
  const linhas = await prisma.$queryRaw<(AlertaDeEstoqueMinimo & { total: number })[]>`
    SELECT p.id_produto, p.nome, p.unidade_medida, p.estoque_minimo,
           COALESCE(SUM(l.quantidade), 0) AS saldo_ativo, count(*) OVER ()::int AS total
    FROM produto p
    LEFT JOIN lote l ON l.id_produto = p.id_produto AND l.status_lote = 'ativo'
    WHERE p.ativo ${produtoDe("p.id_produto", escopo)}
    GROUP BY p.id_produto
    HAVING COALESCE(SUM(l.quantidade), 0) < p.estoque_minimo
    ORDER BY (p.estoque_minimo - COALESCE(SUM(l.quantidade), 0)) DESC, p.nome, p.id_produto
    LIMIT ${MAX_ALERTAS}`;
  return {
    total: linhas[0]?.total ?? 0,
    itens: linhas.map(({ total: _total, ...alerta }) => alerta),
  };
}

export async function montarDashboard(): Promise<Dashboard> {
  const [indicadores, grafico, alertas] = await Promise.all([
    calcularIndicadores(),
    movimentacoesPorDiaETipo(),
    alertasDeEstoqueMinimo(),
  ]);
  return { indicadores, grafico, alertas_estoque_minimo: alertas };
}
