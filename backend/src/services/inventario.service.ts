import { prisma } from "../db.ts";
import { HttpError } from "../errors.ts";
import { Prisma } from "../generated/prisma/client.ts";
import type { status_movimentacao } from "../generated/prisma/enums.ts";
import { executarComoUsuario, instanteDoBanco, type ContextoDeEscrita } from "../transacao.ts";
import { intervaloDe, type Pagina, type Paginacao } from "../validators/comuns.ts";
import {
  LOCK_TIMEOUT_MS,
  SELECAO_MOVIMENTACAO,
  travarLote,
  type MovimentacaoPublica,
} from "./saldo.service.ts";

export type ContagemPublica = MovimentacaoPublica & { divergencia: string };

export type DadosContagem = { id_lote: number; quantidade_contada: string; observacao?: string | null };

export type FiltroContagens = Paginacao & { status?: status_movimentacao; id_lote?: number };

export function comDivergencia(movimentacao: MovimentacaoPublica): ContagemPublica {
  const divergencia = new Prisma.Decimal(movimentacao.quantidade.toString()).minus(
    new Prisma.Decimal(movimentacao.saldo_anterior.toString()),
  );
  return { ...movimentacao, divergencia: divergencia.toString() };
}

export function registrarContagem(contexto: ContextoDeEscrita, dados: DadosContagem): Promise<ContagemPublica> {
  return executarComoUsuario(
    contexto,
    async (tx) => {
      const lote = await travarLote(tx, dados.id_lote);
      const pendente = await tx.movimentacao.findFirst({
        where: { id_lote: dados.id_lote, tipo_movimentacao: "inventario", status_movimentacao: "pendente" },
        select: { id_movimentacao: true },
      });
      if (pendente) {
        throw new HttpError(409, "CONTAGEM_PENDENTE_EXISTENTE", "O lote já tem uma contagem pendente de finalização");
      }
      const instante = await instanteDoBanco(tx);
      const criada = await tx.movimentacao.create({
        data: {
          tipo_movimentacao: "inventario",
          data_movimentacao: instante,
          quantidade: dados.quantidade_contada,
          saldo_anterior: lote.quantidade,
          saldo_posterior: lote.quantidade,
          id_lote: dados.id_lote,
          id_usuario: contexto.idUsuario,
          motivo_movimentacao: "Contagem de inventário",
          observacao: dados.observacao ?? null,
          status_movimentacao: "pendente",
        },
        select: SELECAO_MOVIMENTACAO,
      });
      return comDivergencia(criada);
    },
    { lockTimeoutMs: LOCK_TIMEOUT_MS },
  );
}

export async function obterContagem(id: string): Promise<ContagemPublica> {
  const contagem = await prisma.movimentacao.findFirst({
    where: { id_movimentacao: BigInt(id), tipo_movimentacao: "inventario" },
    select: SELECAO_MOVIMENTACAO,
  });
  if (!contagem) throw new HttpError(404, "NAO_ENCONTRADO", "Contagem não encontrada");
  return comDivergencia(contagem);
}

export async function listarContagens(filtro: FiltroContagens): Promise<Pagina<ContagemPublica>> {
  const { pagina, limite, skip, take } = intervaloDe(filtro);
  const where: Prisma.movimentacaoWhereInput = {
    tipo_movimentacao: "inventario",
    status_movimentacao: filtro.status ?? "pendente",
    ...(filtro.id_lote === undefined ? {} : { id_lote: filtro.id_lote }),
  };
  const [dados, total] = await Promise.all([
    prisma.movimentacao.findMany({ where, select: SELECAO_MOVIMENTACAO, orderBy: [{ id_movimentacao: "desc" }], skip, take }),
    prisma.movimentacao.count({ where }),
  ]);
  return { dados: dados.map(comDivergencia), pagina, limite, total };
}
