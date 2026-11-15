import { prisma } from "../db.ts";
import { HttpError } from "../errors.ts";
import type { Prisma } from "../generated/prisma/client.ts";
import { executarComoUsuario, type ContextoDeEscrita } from "../transacao.ts";
import { intervaloDe, type Pagina, type Paginacao } from "../validators/comuns.ts";

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

export async function listarLocalizacoes(filtro: FiltroLocalizacoes): Promise<Pagina<LocalizacaoPublica>> {
  const { pagina, limite, skip, take } = intervaloDe(filtro);
  const where: Prisma.localizacaoWhereInput = filtro.busca
    ? {
        OR: [
          { corredor: { contains: filtro.busca, mode: "insensitive" } },
          { nivel: { contains: filtro.busca, mode: "insensitive" } },
          { posicao: { contains: filtro.busca, mode: "insensitive" } },
          { descricao: { contains: filtro.busca, mode: "insensitive" } },
        ],
      }
    : {};
  const [dados, total] = await Promise.all([
    prisma.localizacao.findMany({
      where,
      select: SELECAO,
      orderBy: [{ corredor: "asc" }, { nivel: "asc" }, { posicao: "asc" }],
      skip,
      take,
    }),
    prisma.localizacao.count({ where }),
  ]);
  return { dados, pagina, limite, total };
}
