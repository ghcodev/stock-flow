import { prisma } from "../db.ts";
import { HttpError } from "../errors.ts";

export async function verificarBanco(): Promise<void> {
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    throw new HttpError(503, "BANCO_INDISPONIVEL", "Banco de dados indisponível");
  }
}
