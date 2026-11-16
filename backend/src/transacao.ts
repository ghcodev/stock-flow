import type { Request } from "express";
import { prisma } from "./db.ts";
import type { Prisma } from "./generated/prisma/client.ts";
import { usuarioAtual } from "./middlewares/auth.middleware.ts";

export type Tx = Prisma.TransactionClient;

export type ContextoDeEscrita = { idUsuario: number; ip: string };

export type OpcoesTransacao = { lockTimeoutMs?: number };

const ESPERA_MAXIMA_POR_CONEXAO_MS = 2000;
const DURACAO_MAXIMA_MS = 5000;

export function contextoDe(req: Request): ContextoDeEscrita {
  return { idUsuario: usuarioAtual(req).id, ip: req.ip ?? "" };
}

export function executarComoUsuario<T>(
  contexto: ContextoDeEscrita,
  operacao: (tx: Tx) => Promise<T>,
  opcoes: OpcoesTransacao = {},
): Promise<T> {
  return prisma.$transaction(
    async (tx) => {
      await tx.$queryRaw`SELECT set_config('app.user_id', ${String(contexto.idUsuario)}, true), set_config('app.ip', ${contexto.ip}, true)`;
      if (opcoes.lockTimeoutMs !== undefined) {
        await tx.$queryRaw`SELECT set_config('lock_timeout', ${`${opcoes.lockTimeoutMs}ms`}, true)`;
      }
      return operacao(tx);
    },
    { maxWait: ESPERA_MAXIMA_POR_CONEXAO_MS, timeout: DURACAO_MAXIMA_MS },
  );
}

export async function instanteDoBanco(tx: Tx): Promise<Date> {
  const [linha] = await tx.$queryRaw<{ agora: Date | string }[]>`SELECT clock_timestamp() AS agora`;
  return new Date(linha?.agora ?? Date.now());
}

export function executarComoSistema<T>(operacao: (tx: Tx) => Promise<T>, opcoes: OpcoesTransacao = {}): Promise<T> {
  return prisma.$transaction(
    async (tx) => {
      await tx.$queryRaw`SELECT set_config('app.user_id', '', true), set_config('app.ip', '', true)`;
      if (opcoes.lockTimeoutMs !== undefined) {
        await tx.$queryRaw`SELECT set_config('lock_timeout', ${`${opcoes.lockTimeoutMs}ms`}, true)`;
      }
      return operacao(tx);
    },
    { maxWait: ESPERA_MAXIMA_POR_CONEXAO_MS, timeout: DURACAO_MAXIMA_MS },
  );
}
