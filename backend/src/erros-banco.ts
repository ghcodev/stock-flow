import { HttpError } from "./errors.ts";

type ErroPrisma = {
  name?: unknown;
  code?: unknown;
  meta?: { driverAdapterError?: { cause?: { originalCode?: unknown } } };
};

function codigoSql(erro: ErroPrisma): unknown {
  return erro.meta?.driverAdapterError?.cause?.originalCode;
}

export function traduzirErroBanco(err: unknown): HttpError | null {
  if (typeof err !== "object" || err === null) return null;
  const erro = err as ErroPrisma;
  if (erro.name !== "PrismaClientKnownRequestError") return null;
  if (erro.code === "P2002") return new HttpError(409, "REGISTRO_DUPLICADO", "Registro já existente");
  if (erro.code === "P2025") return new HttpError(404, "NAO_ENCONTRADO", "Registro não encontrado");
  if (erro.code === "P2003") return new HttpError(422, "REFERENCIA_INVALIDA", "Referência inválida");
  if (codigoSql(erro) === "23514") {
    return new HttpError(422, "REGRA_VIOLADA", "Os dados violam uma regra do sistema");
  }
  return null;
}
