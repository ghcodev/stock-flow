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

export type LotesPorSituacao = { ativo: number; bloqueado: number; vencido: number; vencendo: number };

export type SaldoDeCategoria = { categoria: string; saldo_kg: Prisma.Decimal };

export type ProdutoMovimentado = { id_produto: number; nome: string; movimentacoes: number };

export type Dashboard = {
  data_referencia: string;
  indicadores: Indicadores;
  grafico: PontoDoGrafico[];
  lotes_por_situacao: LotesPorSituacao;
  saldo_por_categoria: SaldoDeCategoria[];
  top_produtos: ProdutoMovimentado[];
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

export async function lotesPorSituacao(escopo?: Escopo): Promise<LotesPorSituacao> {
  const [linha] = await prisma.$queryRaw<LotesPorSituacao[]>`
    SELECT
      count(*) FILTER (WHERE status_lote = 'ativo')::int AS ativo,
      count(*) FILTER (WHERE status_lote = 'bloqueado')::int AS bloqueado,
      count(*) FILTER (WHERE status_lote = 'vencido')::int AS vencido,
      count(*) FILTER (WHERE status_lote = 'ativo' AND data_validade BETWEEN current_date AND current_date + 30)::int AS vencendo
    FROM lote WHERE TRUE ${produtoDe("id_produto", escopo)}`;
  return linha ?? { ativo: 0, bloqueado: 0, vencido: 0, vencendo: 0 };
}

export function saldoPorCategoria(escopo?: Escopo): Promise<SaldoDeCategoria[]> {
  return prisma.$queryRaw<SaldoDeCategoria[]>`
    SELECT COALESCE(p.categoria, 'Sem categoria') AS categoria, SUM(l.quantidade * p.peso_unitario_kg) AS saldo_kg
    FROM lote l JOIN produto p ON p.id_produto = l.id_produto
    WHERE l.status_lote = 'ativo' AND p.peso_unitario_kg IS NOT NULL ${produtoDe("l.id_produto", escopo)}
    GROUP BY 1 HAVING SUM(l.quantidade * p.peso_unitario_kg) > 0
    ORDER BY 2 DESC, 1 LIMIT 8`;
}

export function produtosMaisMovimentados(escopo?: Escopo): Promise<ProdutoMovimentado[]> {
  return prisma.$queryRaw<ProdutoMovimentado[]>`
    SELECT p.id_produto, p.nome, count(*)::int AS movimentacoes
    FROM movimentacao m JOIN lote l ON l.id_lote = m.id_lote JOIN produto p ON p.id_produto = l.id_produto
    WHERE m.status_movimentacao = 'concluida' AND m.tipo_movimentacao IN ('entrada', 'saida')
      AND m.data_movimentacao >= (current_date - ${DIAS_DO_GRAFICO - 1}::int)::timestamptz
      AND m.data_movimentacao < (current_date + 1)::timestamptz ${produtoDe("l.id_produto", escopo)}
    GROUP BY p.id_produto, p.nome ORDER BY 3 DESC, p.nome, p.id_produto LIMIT 5`;
}

export async function diaDeReferencia(): Promise<string> {
  const [linha] = await prisma.$queryRaw<{ dia: string }[]>`SELECT to_char(current_date, 'YYYY-MM-DD') AS dia`;
  return linha?.dia ?? "";
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
  const [dataReferencia, indicadores, grafico, alertas, situacao, categorias, topo] = await Promise.all([
    diaDeReferencia(),
    calcularIndicadores(),
    movimentacoesPorDiaETipo(),
    alertasDeEstoqueMinimo(),
    lotesPorSituacao(),
    saldoPorCategoria(),
    produtosMaisMovimentados(),
  ]);
  return {
    data_referencia: dataReferencia,
    indicadores,
    grafico,
    lotes_por_situacao: situacao,
    saldo_por_categoria: categorias,
    top_produtos: topo,
    alertas_estoque_minimo: alertas,
  };
}
