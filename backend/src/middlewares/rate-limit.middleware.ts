import { rateLimit } from "express-rate-limit";
import type { RequestHandler } from "express";
import { HttpError } from "../errors.ts";

const JANELA_MS = 15 * 60 * 1000;
const MAX_TENTATIVAS = 10;

function criarLimite(mensagem: string): RequestHandler {
  return rateLimit({
    windowMs: JANELA_MS,
    limit: MAX_TENTATIVAS,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (_req, _res, next) => {
      next(new HttpError(429, "MUITAS_TENTATIVAS", mensagem));
    },
  });
}

export function criarLimiteLogin(): RequestHandler {
  return criarLimite("Muitas tentativas de login. Tente novamente em 15 minutos.");
}

export function criarLimiteTrocaDeSenha(): RequestHandler {
  return criarLimite("Muitas tentativas de troca de senha. Tente novamente em 15 minutos.");
}
