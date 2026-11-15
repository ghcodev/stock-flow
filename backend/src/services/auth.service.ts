import bcrypt from "bcrypt";
import { SignJWT } from "jose";
import { prisma } from "../db.ts";
import { config } from "../config.ts";
import { HttpError } from "../errors.ts";
import type { perfil_usuario } from "../generated/prisma/enums.ts";

const HASH_FIXO = "$2b$12$62tRVnIrGjPhTvnp0HTEduwJPscDs1XRzo1ZQ12Q/tuqtkgl0XS8a";

export const DURACAO_TOKEN = "8h";

export const CHAVE_JWT = new TextEncoder().encode(config.jwtSecret);

export type UsuarioPublico = {
  id_usuario: number;
  nome: string;
  email: string;
  perfil: perfil_usuario;
};

export type ResultadoLogin = { token: string; usuario: UsuarioPublico };

export async function assinarToken(id: number, perfil: perfil_usuario): Promise<string> {
  return new SignJWT({ perfil })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(String(id))
    .setIssuedAt()
    .setExpirationTime(config.jwtExpiresIn)
    .sign(CHAVE_JWT);
}

export async function login(email: string, senha: string): Promise<ResultadoLogin> {
  const usuario = await prisma.usuario.findUnique({
    where: { email },
    select: { id_usuario: true, nome: true, email: true, perfil: true, ativo: true, senha_hash: true },
  });
  const senhaConfere = await bcrypt.compare(senha, usuario?.senha_hash ?? HASH_FIXO);
  if (!usuario || !usuario.ativo || !senhaConfere) {
    throw new HttpError(401, "CREDENCIAIS_INVALIDAS", "E-mail ou senha inválidos");
  }
  const publico: UsuarioPublico = {
    id_usuario: usuario.id_usuario,
    nome: usuario.nome,
    email: usuario.email,
    perfil: usuario.perfil,
  };
  return { token: await assinarToken(usuario.id_usuario, usuario.perfil), usuario: publico };
}
