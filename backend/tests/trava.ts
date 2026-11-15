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
  await pronto;
  return {
    liberar: async () => {
      soltar();
      await transacao;
    },
  };
}
