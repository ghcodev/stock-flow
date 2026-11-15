import { rateLimit } from "express-rate-limit";
import type { RequestHandler } from "express";
import { HttpError } from "../errors.ts";

const JANELA_LOGIN_MS = 15 * 60 * 1000;
const MAX_TENTATIVAS_LOGIN = 10;

export function criarLimiteLogin(): RequestHandler {
  return rateLimit({
    windowMs: JANELA_LOGIN_MS,
    limit: MAX_TENTATIVAS_LOGIN,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (_req, _res, next) => {
      next(new HttpError(429, "MUITAS_TENTATIVAS", "Muitas tentativas de login. Tente novamente em 15 minutos."));
    },
  });
}
