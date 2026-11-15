import type { NextFunction, Request, Response } from "express";
import { HttpError } from "../errors.ts";

type ErroDeCorpo = { type?: string };

function resposta(res: Response, status: number, codigo: string, mensagem: string): void {
  res.status(status).json({ erro: { codigo, mensagem } });
}

export function rotaNaoEncontrada(_req: Request, _res: Response, next: NextFunction): void {
  next(new HttpError(404, "ROTA_NAO_ENCONTRADA", "Rota não encontrada"));
}

export function tratadorDeErros(err: unknown, req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof HttpError) {
    resposta(res, err.status, err.codigo, err.message);
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
  const nome = err instanceof Error ? err.name : "desconhecido";
  process.stderr.write(`erro interno ${req.method} ${req.path} ${nome}\n`);
  resposta(res, 500, "ERRO_INTERNO", "Erro interno do servidor");
}
