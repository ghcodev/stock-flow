import { prisma } from "../db.ts";
import type { Prisma } from "../generated/prisma/client.ts";
import type { status_lote } from "../generated/prisma/enums.ts";
import { type Pagina, type Paginacao } from "../validators/comuns.ts";

const LIMITE_PADRAO = 100;

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
  const lotes = await prisma.lote.findMany({
    where: { id_localizacao: { in: localizacoes.map((l) => l.id_localizacao) }, quantidade: { gt: 0 } },
    select: {
      id_lote: true,
      numero_lote: true,
      status_lote: true,
      quantidade: true,
      id_localizacao: true,
      produto: { select: { nome: true, unidade_medida: true } },
    },
    orderBy: [{ numero_lote: "asc" }, { id_lote: "asc" }],
  });
  const porLocalizacao = new Map<number, LoteNoMapa[]>();
  for (const lote of lotes) {
    const lista = porLocalizacao.get(lote.id_localizacao) ?? [];
    lista.push({
      id_lote: lote.id_lote,
      numero_lote: lote.numero_lote,
      status_lote: lote.status_lote,
      quantidade: lote.quantidade,
      unidade_medida: lote.produto.unidade_medida,
      produto: lote.produto.nome,
    });
    porLocalizacao.set(lote.id_localizacao, lista);
  }
  const dados = localizacoes.map((l) => ({ ...l, lotes: porLocalizacao.get(l.id_localizacao) ?? [] }));
  return { dados, pagina, limite, total };
}
