import { prisma } from "../db.ts";
import { HttpError } from "../errors.ts";
import { Prisma } from "../generated/prisma/client.ts";
import type { status_movimentacao } from "../generated/prisma/enums.ts";
import { executarComoUsuario, instanteDoBanco, type ContextoDeEscrita } from "../transacao.ts";
import { comDivergencia, type ContagemPublica } from "./inventario.service.ts";
import {
  LOCK_TIMEOUT_MS,
  SALDO_MAXIMO,
  SELECAO_MOVIMENTACAO,
  travarLote,
  type MovimentacaoPublica,
} from "./saldo.service.ts";

export type ResultadoFinalizacao = {
  contagem: ContagemPublica;
  ajuste: MovimentacaoPublica | null;
  divergencia: string;
  saldo_final: string;
};

type LinhaDaContagem = {
  id_movimentacao: bigint;
  quantidade: Prisma.Decimal | string | number;
  saldo_anterior: Prisma.Decimal | string | number;
  status: status_movimentacao;
};

export async function finalizarContagem(contexto: ContextoDeEscrita, id: string): Promise<ResultadoFinalizacao> {
  const idContagem = BigInt(id);
  const existente = await prisma.movimentacao.findFirst({
    where: { id_movimentacao: idContagem, tipo_movimentacao: "inventario" },
    select: { id_lote: true },
  });
  if (!existente) throw new HttpError(404, "NAO_ENCONTRADO", "Contagem não encontrada");

  return executarComoUsuario(
    contexto,
    async (tx) => {
      const lote = await travarLote(tx, existente.id_lote);
      const [linha] = await tx.$queryRaw<LinhaDaContagem[]>`
        SELECT id_movimentacao, quantidade, saldo_anterior, status_movimentacao::text AS status
        FROM movimentacao WHERE id_movimentacao = ${idContagem} AND tipo_movimentacao = 'inventario' FOR UPDATE`;
      if (!linha) throw new HttpError(404, "NAO_ENCONTRADO", "Contagem não encontrada");
      if (linha.status !== "pendente") {
        throw new HttpError(409, "CONTAGEM_JA_FINALIZADA", "A contagem não está pendente");
      }
      const contado = new Prisma.Decimal(linha.quantidade.toString());
      const saldoDaContagem = new Prisma.Decimal(linha.saldo_anterior.toString());
      const divergencia = contado.minus(saldoDaContagem);
      const saldoFinal = lote.quantidade.plus(divergencia);
      if (saldoFinal.lt(0)) {
        throw new HttpError(409, "SALDO_FINAL_NEGATIVO", "O saldo atual do lote não comporta a divergência da contagem");
      }
      if (saldoFinal.gt(SALDO_MAXIMO)) {
        throw new HttpError(422, "SALDO_EXCEDE_LIMITE", "O saldo do lote excederia o limite permitido");
      }
      const instante = await instanteDoBanco(tx);
      let ajuste: MovimentacaoPublica | null = null;
      if (!divergencia.isZero()) {
        await tx.lote.update({
          where: { id_lote: existente.id_lote },
          data: { quantidade: saldoFinal },
          select: { id_lote: true },
        });
        ajuste = await tx.movimentacao.create({
          data: {
            tipo_movimentacao: "ajuste",
            data_movimentacao: instante,
            quantidade: divergencia.abs(),
            saldo_anterior: lote.quantidade,
            saldo_posterior: saldoFinal,
            id_lote: existente.id_lote,
            id_usuario: contexto.idUsuario,
            motivo_movimentacao: `Finalização da contagem de inventário ${id}`,
            status_movimentacao: "concluida",
          },
          select: SELECAO_MOVIMENTACAO,
        });
      }
      await tx.movimentacao.updateMany({
        where: { id_movimentacao: idContagem, status_movimentacao: "pendente" },
        data: { status_movimentacao: "concluida" },
      });
      const concluida = await tx.movimentacao.findUniqueOrThrow({
        where: { id_movimentacao: idContagem },
        select: SELECAO_MOVIMENTACAO,
      });
      return {
        contagem: comDivergencia(concluida),
        ajuste,
        divergencia: divergencia.toString(),
        saldo_final: saldoFinal.toString(),
      };
    },
    { lockTimeoutMs: LOCK_TIMEOUT_MS },
  );
}
