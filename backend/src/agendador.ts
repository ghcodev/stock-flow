import { Prisma } from "./generated/prisma/client.ts";
import { executarComoSistema } from "./transacao.ts";

const LOCK_TIMEOUT_MS = 1500;
const TAMANHO_DO_LOTE = 500;
const MAX_RODADAS = 200;
const UM_DIA_MS = 24 * 60 * 60 * 1000;

export type EscopoDoAgendador = { idsDeLote: number[] };

export async function marcarLotesVencidos(escopo?: EscopoDoAgendador): Promise<number> {
  let total = 0;
  for (let rodada = 0; rodada < MAX_RODADAS; rodada++) {
    const restringir = escopo ? Prisma.sql`AND id_lote = ANY(${escopo.idsDeLote}::int[])` : Prisma.empty;
    const { candidatos, marcados } = await executarComoSistema(
      async (tx) => {
        const achados = await tx.$queryRaw<{ id_lote: number }[]>`
          SELECT id_lote FROM lote
          WHERE status_lote = 'ativo' AND data_validade IS NOT NULL AND data_validade < hoje_operacional() ${restringir}
          ORDER BY id_lote LIMIT ${TAMANHO_DO_LOTE} FOR UPDATE SKIP LOCKED`;
        if (achados.length === 0) return { candidatos: 0, marcados: 0 };
        const resultado = await tx.lote.updateMany({
          where: { id_lote: { in: achados.map((a) => a.id_lote) }, status_lote: "ativo" },
          data: { status_lote: "vencido" },
        });
        return { candidatos: achados.length, marcados: resultado.count };
      },
      { lockTimeoutMs: LOCK_TIMEOUT_MS },
    );
    total += marcados;
    if (candidatos < TAMANHO_DO_LOTE) break;
  }
  return total;
}

export type Agendador = { parar: () => Promise<void> };

export function iniciarAgendador(
  executar: () => Promise<unknown>,
  intervaloMs: number = UM_DIA_MS,
  escrever: (texto: string) => void = (texto) => void process.stderr.write(texto),
): Agendador {
  let emExecucao: Promise<void> | null = null;
  let parado = false;

  const rodar = (): void => {
    if (parado || emExecucao) return;
    emExecucao = executar()
      .then(() => undefined)
      .catch(() => {
        escrever("Agendador: falha na execução\n");
      })
      .finally(() => {
        emExecucao = null;
      });
  };

  const temporizador = setInterval(rodar, intervaloMs);
  temporizador.unref();
  setImmediate(rodar);

  return {
    parar: async () => {
      parado = true;
      clearInterval(temporizador);
      await emExecucao;
    },
  };
}

export function criarDesconexao(agendador: Agendador | null, desconectar: () => Promise<void>): () => Promise<void> {
  return async () => {
    await agendador?.parar();
    await desconectar();
  };
}
