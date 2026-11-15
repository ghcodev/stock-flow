import { prisma } from "../src/db.ts";

export type Retencao = { liberar: () => Promise<void> };

export async function segurarLote(idLote: number): Promise<Retencao> {
  let soltar: () => void = () => {};
  const espera = new Promise<void>((ok) => (soltar = ok));
  let travou: () => void = () => {};
  const pronto = new Promise<void>((ok) => (travou = ok));
  const transacao = prisma.$transaction(
    async (tx) => {
      await tx.$queryRaw`SELECT id_lote FROM lote WHERE id_lote = ${idLote} FOR UPDATE`;
      travou();
      await espera;
    },
    { timeout: 30000 },
  );
  const falhaAntesDeTravar = new Promise<never>((_ok, rejeitar) => {
    transacao.then(() => rejeitar(new Error("A transação terminou antes de travar o lote")), rejeitar);
  });
  falhaAntesDeTravar.catch(() => {});
  await Promise.race([pronto, falhaAntesDeTravar]);
  return {
    liberar: async () => {
      soltar();
      await transacao;
    },
  };
}
