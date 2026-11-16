import { prisma } from "../db.ts";
import type { Prisma } from "../generated/prisma/client.ts";
import type { status_lote } from "../generated/prisma/enums.ts";
import { type Pagina, type Paginacao } from "../validators/comuns.ts";

const LIMITE_PADRAO = 100;
export const MAX_LOTES_POR_POSICAO = 50;

export type FiltroMapa = Paginacao & { corredor?: string };

export type LoteNoMapa = {
  id_lote: number;
  numero_lote: string;
  status_lote: status_lote;
  quantidade: Prisma.Decimal;
  unidade_medida: string;
  produto: string;
};

export type PosicaoDoMapa = {
  id_localizacao: number;
  corredor: string;
  nivel: string;
  posicao: string;
  capacidade: Prisma.Decimal | null;
  descricao: string | null;
  total_lotes: number;
  lotes: LoteNoMapa[];
};

export async function montarMapa(filtro: FiltroMapa): Promise<Pagina<PosicaoDoMapa>> {
  const pagina = filtro.pagina ?? 1;
  const limite = filtro.limite ?? LIMITE_PADRAO;
  const where: Prisma.localizacaoWhereInput = filtro.corredor === undefined ? {} : { corredor: filtro.corredor };
  const [localizacoes, total] = await Promise.all([
    prisma.localizacao.findMany({
      where,
      select: { id_localizacao: true, corredor: true, nivel: true, posicao: true, capacidade: true, descricao: true },
      orderBy: [{ corredor: "asc" }, { nivel: "asc" }, { posicao: "asc" }, { id_localizacao: "asc" }],
      skip: (pagina - 1) * limite,
      take: limite,
    }),
    prisma.localizacao.count({ where }),
  ]);
  const ids = localizacoes.map((l) => l.id_localizacao);
  const lotes = await prisma.$queryRaw<(LoteNoMapa & { id_localizacao: number; total_lotes: number })[]>`
    SELECT t.id_lote, t.numero_lote, t.status_lote, t.quantidade, t.unidade_medida, t.produto, t.id_localizacao, t.total_lotes
    FROM (
      SELECT l.id_lote, l.numero_lote, l.status_lote::text AS status_lote, l.quantidade, p.unidade_medida,
             p.nome AS produto, l.id_localizacao,
             row_number() OVER (PARTITION BY l.id_localizacao ORDER BY l.numero_lote, l.id_lote) AS ordem,
             count(*) OVER (PARTITION BY l.id_localizacao)::int AS total_lotes
      FROM lote l JOIN produto p ON p.id_produto = l.id_produto
      WHERE l.id_localizacao = ANY(${ids}::int[]) AND l.quantidade > 0
    ) t
    WHERE t.ordem <= ${MAX_LOTES_POR_POSICAO}
    ORDER BY t.id_localizacao, t.ordem`;
  const porLocalizacao = new Map<number, LoteNoMapa[]>();
  const totais = new Map<number, number>();
  for (const { id_localizacao, total_lotes, ...lote } of lotes) {
    const lista = porLocalizacao.get(id_localizacao) ?? [];
    lista.push(lote);
    porLocalizacao.set(id_localizacao, lista);
    totais.set(id_localizacao, total_lotes);
  }
  const dados = localizacoes.map((l) => ({
    ...l,
    total_lotes: totais.get(l.id_localizacao) ?? 0,
    lotes: porLocalizacao.get(l.id_localizacao) ?? [],
  }));
  return { dados, pagina, limite, total };
}
