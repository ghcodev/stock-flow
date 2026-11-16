import { prisma } from "../db.ts";
import { HttpError } from "../errors.ts";
import type { status_movimentacao } from "../generated/prisma/enums.ts";
import { executarComoUsuario, type ContextoDeEscrita } from "../transacao.ts";
import { comDivergencia, type ContagemPublica } from "./inventario.service.ts";
import { LOCK_TIMEOUT_MS, SELECAO_MOVIMENTACAO, travarLote } from "./saldo.service.ts";

export async function cancelarContagem(contexto: ContextoDeEscrita, id: string): Promise<ContagemPublica> {
  const idContagem = BigInt(id);
  const existente = await prisma.movimentacao.findFirst({
    where: { id_movimentacao: idContagem, tipo_movimentacao: "inventario" },
    select: { id_lote: true },
  });
  if (!existente) throw new HttpError(404, "NAO_ENCONTRADO", "Contagem não encontrada");

  return executarComoUsuario(
    contexto,
    async (tx) => {
      await travarLote(tx, existente.id_lote);
      const [linha] = await tx.$queryRaw<{ status: status_movimentacao }[]>`
        SELECT status_movimentacao::text AS status FROM movimentacao
        WHERE id_movimentacao = ${idContagem} AND tipo_movimentacao = 'inventario' FOR UPDATE`;
      if (!linha) throw new HttpError(404, "NAO_ENCONTRADO", "Contagem não encontrada");
      if (linha.status !== "pendente") {
        throw new HttpError(409, "CONTAGEM_NAO_PENDENTE", "Somente contagem pendente pode ser cancelada");
      }
      await tx.movimentacao.updateMany({
        where: { id_movimentacao: idContagem, status_movimentacao: "pendente" },
        data: { status_movimentacao: "cancelada" },
      });
      const cancelada = await tx.movimentacao.findUniqueOrThrow({
        where: { id_movimentacao: idContagem },
        select: SELECAO_MOVIMENTACAO,
      });
      return comDivergencia(cancelada);
    },
    { lockTimeoutMs: LOCK_TIMEOUT_MS },
  );
}
