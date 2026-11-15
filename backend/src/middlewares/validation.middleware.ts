import type { NextFunction, Request, Response } from "express";
import { validationResult } from "express-validator";
import { HttpError, type CampoInvalido } from "../errors.ts";

export function validar(req: Request, _res: Response, next: NextFunction): void {
  const resultado = validationResult(req);
  if (resultado.isEmpty()) {
    next();
    return;
  }
  const campos: CampoInvalido[] = resultado.array({ onlyFirstError: true }).map((erro) => ({
    campo: erro.type === "field" ? erro.path : "corpo",
    mensagem: typeof erro.msg === "string" ? erro.msg : "Valor inválido",
  }));
  next(new HttpError(400, "VALIDACAO", "Dados inválidos", campos));
}
