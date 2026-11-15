import { prisma } from "../db.ts";
import { HttpError } from "../errors.ts";
import type { Prisma } from "../generated/prisma/client.ts";
import { executarComoUsuario, type ContextoDeEscrita } from "../transacao.ts";
import { intervaloDe, type Pagina, type Paginacao } from "../validators/comuns.ts";
import { literalParaLike } from "../busca.ts";

const SELECAO = {
  id_produto: true,
  nome: true,
  categoria: true,
  descricao: true,
  unidade_medida: true,
  estoque_minimo: true,
  ativo: true,
  created_at: true,
} as const;

export type ProdutoPublico = Prisma.produtoGetPayload<{ select: typeof SELECAO }>;

export type DadosProduto = {
  nome: string;
  categoria?: string | null;
  descricao?: string | null;
  unidade_medida: string;
  estoque_minimo?: string;
};

export type FiltroProdutos = Paginacao & { busca?: string; ativo?: boolean };

export function criarProduto(contexto: ContextoDeEscrita, dados: DadosProduto): Promise<ProdutoPublico> {
  return executarComoUsuario(contexto, (tx) => tx.produto.create({ data: dados, select: SELECAO }));
}

export function atualizarProduto(
  contexto: ContextoDeEscrita,
  id: number,
  dados: Partial<DadosProduto>,
): Promise<ProdutoPublico> {
  return executarComoUsuario(contexto, (tx) =>
    tx.produto.update({ where: { id_produto: id }, data: dados, select: SELECAO }),
  );
}

export function inativarProduto(contexto: ContextoDeEscrita, id: number): Promise<ProdutoPublico> {
  return executarComoUsuario(contexto, (tx) =>
    tx.produto.update({ where: { id_produto: id }, data: { ativo: false }, select: SELECAO }),
  );
}

export async function obterProduto(id: number): Promise<ProdutoPublico> {
  const produto = await prisma.produto.findUnique({ where: { id_produto: id }, select: SELECAO });
  if (!produto) throw new HttpError(404, "NAO_ENCONTRADO", "Produto não encontrado");
  return produto;
}

export async function listarProdutos(filtro: FiltroProdutos): Promise<Pagina<ProdutoPublico>> {
  const { pagina, limite, skip, take } = intervaloDe(filtro);
  const where: Prisma.produtoWhereInput = {
    ...(filtro.ativo === undefined ? {} : { ativo: filtro.ativo }),
    ...(filtro.busca
      ? {
          OR: [
            { nome: { contains: literalParaLike(filtro.busca), mode: "insensitive" } },
            { categoria: { contains: literalParaLike(filtro.busca), mode: "insensitive" } },
          ],
        }
      : {}),
  };
  const [dados, total] = await Promise.all([
    prisma.produto.findMany({ where, select: SELECAO, orderBy: [{ nome: "asc" }, { id_produto: "asc" }], skip, take }),
    prisma.produto.count({ where }),
  ]);
  return { dados, pagina, limite, total };
}
