import { prisma } from "../db.ts";
import { HttpError } from "../errors.ts";
import { Prisma } from "../generated/prisma/client.ts";
import { executarComoUsuario, type ContextoDeEscrita } from "../transacao.ts";
import { intervaloDe, type Pagina, type Paginacao } from "../validators/comuns.ts";
import { literalParaLike } from "../busca.ts";

const SELECAO = {
  id_localizacao: true,
  corredor: true,
  nivel: true,
  posicao: true,
  capacidade: true,
  descricao: true,
} as const;

export type LocalizacaoPublica = Prisma.localizacaoGetPayload<{ select: typeof SELECAO }>;

export type DadosLocalizacao = {
  corredor: string;
  nivel: string;
  posicao: string;
  descricao?: string | null;
  capacidade?: string;
};

export type FiltroLocalizacoes = Paginacao & { busca?: string };

export function criarLocalizacao(
  contexto: ContextoDeEscrita,
  dados: DadosLocalizacao,
): Promise<LocalizacaoPublica> {
  return executarComoUsuario(contexto, (tx) => tx.localizacao.create({ data: dados, select: SELECAO }));
}

export async function obterLocalizacao(id: number): Promise<LocalizacaoPublica> {
  const localizacao = await prisma.localizacao.findUnique({ where: { id_localizacao: id }, select: SELECAO });
  if (!localizacao) throw new HttpError(404, "NAO_ENCONTRADO", "Localização não encontrada");
  return localizacao;
}

export function rotuloCombinadoDeBusca(busca: string): string {
  return busca.trim().replace(/[\s/]+/g, "-").replace(/-{2,}/g, "-");
}

async function listarPorBusca(busca: string, skip: number, take: number): Promise<{ ids: number[]; total: number }> {
  const termo = `%${literalParaLike(busca)}%`;
  const combinado = rotuloCombinadoDeBusca(busca);
  const combinadoLike = `%${literalParaLike(combinado)}%`;
  const prefixoLike = `${literalParaLike(combinado)}%`;
  const rotulo = Prisma.sql`(l.corredor || '-' || l.nivel || '-' || l.posicao)`;
  const condicao = Prisma.sql`(
    l.corredor ILIKE ${termo} OR l.nivel ILIKE ${termo} OR l.posicao ILIKE ${termo} OR l.descricao ILIKE ${termo}
    OR ${rotulo} ILIKE ${combinadoLike})`;
  const [linhas, contagem] = await Promise.all([
    prisma.$queryRaw<{ id_localizacao: number }[]>(Prisma.sql`
      SELECT l.id_localizacao FROM localizacao l
      WHERE ${condicao}
      ORDER BY (lower(${rotulo}) = lower(${combinado})) DESC,
               (${rotulo} ILIKE ${prefixoLike}) DESC,
               l.corredor, l.nivel, l.posicao, l.id_localizacao
      LIMIT ${take} OFFSET ${skip}`),
    prisma.$queryRaw<{ total: bigint }[]>(Prisma.sql`SELECT count(*) AS total FROM localizacao l WHERE ${condicao}`),
  ]);
  return { ids: linhas.map((linha) => linha.id_localizacao), total: Number(contagem[0]?.total ?? 0n) };
}

export async function listarLocalizacoes(filtro: FiltroLocalizacoes): Promise<Pagina<LocalizacaoPublica>> {
  const { pagina, limite, skip, take } = intervaloDe(filtro);
  if (filtro.busca) {
    const { ids, total } = await listarPorBusca(filtro.busca, skip, take);
    const lidas = await prisma.localizacao.findMany({ where: { id_localizacao: { in: ids } }, select: SELECAO });
    const porId = new Map(lidas.map((l) => [l.id_localizacao, l]));
    const dados = ids.flatMap((id) => porId.get(id) ?? []);
    return { dados, pagina, limite, total };
  }
  const [dados, total] = await Promise.all([
    prisma.localizacao.findMany({
      select: SELECAO,
      orderBy: [{ corredor: "asc" }, { nivel: "asc" }, { posicao: "asc" }],
      skip,
      take,
    }),
    prisma.localizacao.count(),
  ]);
  return { dados, pagina, limite, total };
}
