import type { NextFunction, Request, Response } from "express";
import { jwtVerify } from "jose";
import { prisma } from "../db.ts";
import { HttpError } from "../errors.ts";
import { CHAVE_JWT } from "../services/auth.service.ts";
import type { UsuarioAutenticado } from "../types/usuario.ts";

const MAX_ID_INTEGER = 2_147_483_647;

function naoAutenticado(): HttpError {
  return new HttpError(401, "NAO_AUTENTICADO", "Autenticação inválida ou ausente");
}

async function idDoToken(token: string): Promise<number> {
  let sub: string | undefined;
  try {
    ({ payload: { sub } } = await jwtVerify(token, CHAVE_JWT, { algorithms: ["HS256"] }));
  } catch {
    throw naoAutenticado();
  }
  const id = Number(sub);
  if (!sub || !/^\d+$/.test(sub) || id < 1 || id > MAX_ID_INTEGER) throw naoAutenticado();
  return id;
}

export async function autenticar(req: Request, _res: Response, next: NextFunction): Promise<void> {
  const token = /^Bearer (\S+)$/.exec(req.headers.authorization ?? "")?.[1];
  if (!token) throw naoAutenticado();
  const id = await idDoToken(token);
  const usuario = await prisma.usuario.findUnique({
    where: { id_usuario: id },
    select: { id_usuario: true, nome: true, email: true, perfil: true, ativo: true },
  });
  if (!usuario || !usuario.ativo) throw naoAutenticado();
  req.usuario = {
    id: usuario.id_usuario,
    nome: usuario.nome,
    email: usuario.email,
    perfil: usuario.perfil,
  };
  next();
}

export function usuarioAtual(req: Request): UsuarioAutenticado {
  if (!req.usuario) throw naoAutenticado();
  return req.usuario;
}
