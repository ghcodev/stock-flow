import { HttpError } from "./errors.ts";

type ErroPrisma = {
  name?: unknown;
  code?: unknown;
  meta?: { code?: unknown; driverAdapterError?: { cause?: { originalCode?: unknown } } };
};

function codigoSql(erro: ErroPrisma): string | undefined {
  const codigo = erro.meta?.driverAdapterError?.cause?.originalCode ?? erro.meta?.code;
  return typeof codigo === "string" ? codigo : undefined;
}

export function traduzirErroBanco(err: unknown): HttpError | null {
  if (typeof err !== "object" || err === null) return null;
  const erro = err as ErroPrisma;
  if (erro.name !== "PrismaClientKnownRequestError") return null;
  const sql = codigoSql(erro);
  if (sql === "55P03" || sql === "40P01") {
    return new HttpError(409, "LOTE_EM_USO", "O lote está sendo usado por outra operação. Tente novamente");
  }
  if (sql === "P0001") {
    return new HttpError(422, "OPERACAO_RECUSADA", "A operação foi recusada pelas regras do banco de dados");
  }
  if (sql === "22003") {
    return new HttpError(422, "VALOR_FORA_DO_LIMITE", "O valor informado excede o limite permitido");
  }
  if (erro.code === "P2002") return new HttpError(409, "REGISTRO_DUPLICADO", "Registro já existente");
  if (erro.code === "P2025") return new HttpError(404, "NAO_ENCONTRADO", "Registro não encontrado");
  if (erro.code === "P2003") return new HttpError(422, "REFERENCIA_INVALIDA", "Referência inválida");
  if (erro.code === "P2028") {
    return new HttpError(503, "SERVICO_OCUPADO", "Serviço temporariamente ocupado. Tente novamente");
  }
  if (sql === "23514") return new HttpError(422, "REGRA_VIOLADA", "Os dados violam uma regra do sistema");
  return null;
}
