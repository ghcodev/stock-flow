import { prisma } from "../db.ts";
import { HttpError } from "../errors.ts";
import { Prisma } from "../generated/prisma/client.ts";
import type { status_lote, tipo_identificacao } from "../generated/prisma/enums.ts";
import { executarComoUsuario, type ContextoDeEscrita, type Tx } from "../transacao.ts";
import { intervaloDe, type Pagina, type Paginacao } from "../validators/comuns.ts";
import { literalParaLike } from "../busca.ts";

const SELECAO_PRODUTO = { id_produto: true, nome: true, unidade_medida: true } as const;
const SELECAO_LOCALIZACAO = { id_localizacao: true, corredor: true, nivel: true, posicao: true } as const;
const SELECAO_ETIQUETA = { id_identificacao: true, tipo_identificacao: true, codigo: true } as const;

const SELECAO_ESCALAR = {
  id_lote: true,
  numero_lote: true,
  data_fabricacao: true,
  data_validade: true,
  quantidade: true,
  status_lote: true,
  data_bloqueio: true,
  motivo_bloqueio: true,
  id_produto: true,
  id_localizacao: true,
} as const;

const SELECAO = {
  ...SELECAO_ESCALAR,
  produto: { select: SELECAO_PRODUTO },
  localizacao: { select: SELECAO_LOCALIZACAO },
  identificacao: { select: SELECAO_ETIQUETA },
} as const;

type LoteBanco = Prisma.loteGetPayload<{ select: typeof SELECAO }>;

export type LotePublico = Omit<LoteBanco, "data_fabricacao" | "data_validade"> & {
  data_fabricacao: string | null;
  data_validade: string | null;
};

export type DadosLote = {
  numero_lote: string;
  id_produto: number;
  id_localizacao: number;
  quantidade?: string;
  data_fabricacao?: string | null;
  data_validade?: string | null;
  etiqueta?: { tipo: tipo_identificacao; codigo: string } | null;
};

export type FiltroLotes = Paginacao & {
  id_produto?: number;
  id_localizacao?: number;
  numero_lote?: string;
  status?: status_lote;
};

const dia = (data: Date | null): string | null => (data ? data.toISOString().slice(0, 10) : null);
const paraData = (texto: string | null | undefined): Date | null | undefined =>
  texto === undefined ? undefined : texto === null ? null : new Date(`${texto}T00:00:00.000Z`);

function apresentar(lote: LoteBanco): LotePublico {
  return { ...lote, data_fabricacao: dia(lote.data_fabricacao), data_validade: dia(lote.data_validade) };
}

async function buscarNaTransacao(tx: Tx, id: number): Promise<LotePublico> {
  const lote = await tx.lote.findUnique({ where: { id_lote: id }, select: SELECAO_ESCALAR });
  if (!lote) throw new HttpError(404, "NAO_ENCONTRADO", "Lote não encontrado");
  const produto = await tx.produto.findUniqueOrThrow({
    where: { id_produto: lote.id_produto },
    select: SELECAO_PRODUTO,
  });
  const localizacao = await tx.localizacao.findUniqueOrThrow({
    where: { id_localizacao: lote.id_localizacao },
    select: SELECAO_LOCALIZACAO,
  });
  const identificacao = await tx.identificacao.findUnique({ where: { id_lote: id }, select: SELECAO_ETIQUETA });
  return apresentar({ ...lote, produto, localizacao, identificacao });
}

export async function criarLote(contexto: ContextoDeEscrita, dados: DadosLote): Promise<LotePublico> {
  return executarComoUsuario(contexto, async (tx) => {
    const [produto] = await tx.$queryRaw<
      { ativo: boolean }[]
    >`SELECT ativo FROM produto WHERE id_produto = ${dados.id_produto} FOR SHARE`;
    if (!produto)throw new HttpError(422, "PRODUTO_INVALIDO", "Produto não encontrado");
    if (!produto.ativo) throw new HttpError(422, "PRODUTO_INATIVO", "Produto inativo não pode receber lotes");
    const localizacao = await tx.localizacao.findUnique({
      where: { id_localizacao: dados.id_localizacao },
      select: { id_localizacao: true },
    });
    if (!localizacao) throw new HttpError(422, "LOCALIZACAO_INVALIDA", "Localização não encontrada");
    const criado = await tx.lote.create({
      data: {
        numero_lote: dados.numero_lote,
        id_produto: dados.id_produto,
        id_localizacao: dados.id_localizacao,
        ...(dados.quantidade === undefined ? {} : { quantidade: dados.quantidade }),
        data_fabricacao: paraData(dados.data_fabricacao) ?? null,
        data_validade: paraData(dados.data_validade) ?? null,
        ...(dados.etiqueta?.codigo !== undefined && dados.etiqueta.tipo !== undefined
          ? { identificacao: { create: { tipo_identificacao: dados.etiqueta.tipo, codigo: dados.etiqueta.codigo } } }
          : {}),
      },
      select: { id_lote: true },
    });
    if (dados.quantidade !== undefined && new Prisma.Decimal(dados.quantidade).gt(0)) {
      await tx.movimentacao.create({
        data: {
          tipo_movimentacao: "entrada",
          quantidade: dados.quantidade,
          saldo_anterior: "0",
          saldo_posterior: dados.quantidade,
          id_lote: criado.id_lote,
          id_usuario: contexto.idUsuario,
          id_localizacao_destino: dados.id_localizacao,
          motivo_movimentacao: "Saldo inicial do lote",
        },
        select: { id_movimentacao: true },
      });
    }
    return buscarNaTransacao(tx, criado.id_lote);
  });
}

export async function obterLote(id: number): Promise<LotePublico> {
  const lote = await prisma.lote.findUnique({ where: { id_lote: id }, select: SELECAO });
  if (!lote) throw new HttpError(404, "NAO_ENCONTRADO", "Lote não encontrado");
  return apresentar(lote);
}

export async function listarLotes(filtro: FiltroLotes): Promise<Pagina<LotePublico>> {
  const { pagina, limite, skip, take } = intervaloDe(filtro);
  const where: Prisma.loteWhereInput = {
    ...(filtro.id_produto === undefined ? {} : { id_produto: filtro.id_produto }),
    ...(filtro.id_localizacao === undefined ? {} : { id_localizacao: filtro.id_localizacao }),
    ...(filtro.status === undefined ? {} : { status_lote: filtro.status }),
    ...(filtro.numero_lote ? { numero_lote: { contains: literalParaLike(filtro.numero_lote), mode: "insensitive" } } : {}),
  };
  const [lotes, total] = await Promise.all([
    prisma.lote.findMany({ where, select: SELECAO, orderBy: [{ id_lote: "desc" }], skip, take }),
    prisma.lote.count({ where }),
  ]);
  return { dados: lotes.map(apresentar), pagina, limite, total };
}

export function bloquearLote(contexto: ContextoDeEscrita, id: number, motivo: string): Promise<LotePublico> {
  return executarComoUsuario(contexto, async (tx) => {
    const atualizados = await tx.lote.updateMany({
      where: { id_lote: id, status_lote: "ativo" },
      data: { status_lote: "bloqueado", data_bloqueio: new Date(), motivo_bloqueio: motivo },
    });
    if (atualizados.count === 0) {
      await buscarNaTransacao(tx, id);
      throw new HttpError(409, "LOTE_NAO_ATIVO", "Somente lote ativo pode ser bloqueado");
    }
    return buscarNaTransacao(tx, id);
  });
}

export function desbloquearLote(contexto: ContextoDeEscrita, id: number): Promise<LotePublico> {
  return executarComoUsuario(contexto, async (tx) => {
    const atual = await buscarNaTransacao(tx, id);
    if (atual.status_lote !== "bloqueado") {
      throw new HttpError(409, "LOTE_NAO_BLOQUEADO", "Somente lote bloqueado pode ser desbloqueado");
    }
    const hoje = new Date().toISOString().slice(0, 10);
    const expirado = atual.data_validade !== null && atual.data_validade < hoje;
    const atualizados = await tx.lote.updateMany({
      where: { id_lote: id, status_lote: "bloqueado" },
      data: { status_lote: expirado ? "vencido" : "ativo", data_bloqueio: null, motivo_bloqueio: null },
    });
    if (atualizados.count === 0) {
      throw new HttpError(409, "LOTE_NAO_BLOQUEADO", "Somente lote bloqueado pode ser desbloqueado");
    }
    return buscarNaTransacao(tx, id);
  });
}
