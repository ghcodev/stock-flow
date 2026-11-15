import type { NextFunction, Request, Response } from "express";
import { HttpError, type CampoInvalido } from "../errors.ts";
import { traduzirErroBanco } from "../erros-banco.ts";

type ErroDeCorpo = { type?: string };

const CATEGORIAS_PERMITIDAS = new Set([
  "Error",
  "TypeError",
  "RangeError",
  "SyntaxError",
  "PrismaClientKnownRequestError",
  "PrismaClientUnknownRequestError",
  "PrismaClientInitializationError",
  "PrismaClientValidationError",
]);

function categoriaDoErro(err: unknown): string {
  return err instanceof Error && CATEGORIAS_PERMITIDAS.has(err.name) ? err.name : "Desconhecido";
}

function resposta(
  res: Response,
  status: number,
  codigo: string,
  mensagem: string,
  campos?: CampoInvalido[],
): void {
  res.status(status).json({ erro: campos ? { codigo, mensagem, campos } : { codigo, mensagem } });
}

export function rotaNaoEncontrada(_req: Request, _res: Response, next: NextFunction): void {
  next(new HttpError(404, "ROTA_NAO_ENCONTRADA", "Rota não encontrada"));
}

export function tratadorDeErros(err: unknown, req: Request, res: Response, _next: NextFunction): void {
  const conhecido = err instanceof HttpError ? err : traduzirErroBanco(err);
  if (conhecido) {
    resposta(res, conhecido.status, conhecido.codigo, conhecido.message, conhecido.campos);
    return;
  }
  const tipo = (err as ErroDeCorpo | null)?.type;
  if (tipo === "entity.parse.failed") {
    resposta(res, 400, "JSON_INVALIDO", "Corpo da requisição não é um JSON válido");
    return;
  }
  if (tipo === "entity.too.large") {
    resposta(res, 413, "CORPO_MUITO_GRANDE", "Corpo da requisição excede o limite");
    return;
  }
  process.stderr.write(`erro interno ${req.method} ${categoriaDoErro(err)}\n`);
  resposta(res, 500, "ERRO_INTERNO", "Erro interno do servidor");
}
