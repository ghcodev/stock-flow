import type { NextFunction, Request, Response } from "express";
import { HttpError } from "../errors.ts";
import type { perfil_usuario } from "../generated/prisma/enums.ts";
import { usuarioAtual } from "./auth.middleware.ts";

export function exigirPerfil(...perfis: perfil_usuario[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!perfis.includes(usuarioAtual(req).perfil)) {
      throw new HttpError(403, "ACESSO_NEGADO", "Perfil sem permissão para esta operação");
    }
    next();
  };
}

export const exigirOperacional = exigirPerfil("administrador", "operador");

export const exigirAdministrador = exigirPerfil("administrador");
