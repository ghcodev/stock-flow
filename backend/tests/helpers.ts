import type { Express } from "express";
import type { AddressInfo } from "node:net";
import { randomUUID } from "node:crypto";
import bcrypt from "bcrypt";
import { prisma } from "../src/db.ts";
import { assinarToken } from "../src/services/auth.service.ts";
import type { perfil_usuario } from "../src/generated/prisma/enums.ts";

export type Servidor = { url: string; fechar: () => Promise<void> };

export function subir(app: Express): Promise<Servidor> {
  return new Promise((resolve) => {
    const server = app.listen(0, "127.0.0.1", () => {
      const { port } = server.address() as AddressInfo;
      resolve({
        url: `http://127.0.0.1:${port}`,
        fechar: () => new Promise((ok) => server.close(() => ok())),
      });
    });
  });
}

export type UsuarioTeste = { id: number; email: string; senha: string; perfil: perfil_usuario };

const criados: number[] = [];

export async function criarUsuarioTeste(
  perfil: perfil_usuario,
  ativo = true,
): Promise<UsuarioTeste> {
  const sufixo = randomUUID();
  const senha = `Senha-${sufixo}`;
  const email = `teste-${sufixo}@teste.local`;
  const criado = await prisma.usuario.create({
    data: {
      nome: `Teste ${sufixo}`,
      email,
      senha_hash: await bcrypt.hash(senha, 12),
      perfil,
      ativo,
    },
    select: { id_usuario: true },
  });
  criados.push(criado.id_usuario);
  return { id: criado.id_usuario, email, senha, perfil };
}

export async function tokenDe(usuario: UsuarioTeste): Promise<string> {
  return assinarToken(usuario.id, usuario.perfil);
}

export async function desativarUsuariosTeste(): Promise<void> {
  await prisma.usuario.updateMany({ where: { id_usuario: { in: criados } }, data: { ativo: false } });
}
