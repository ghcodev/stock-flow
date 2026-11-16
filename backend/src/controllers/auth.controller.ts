import type { Request, Response } from "express";
import { usuarioAtual } from "../middlewares/auth.middleware.ts";
import { login } from "../services/auth.service.ts";
import { trocarSenha } from "../services/senha.service.ts";
import { contextoDe } from "../transacao.ts";
import { dadosValidados } from "../validators/comuns.ts";

type CorpoLogin = { email: string; senha: string };

export async function entrar(req: Request, res: Response): Promise<void> {
  const { email, senha } = req.body as CorpoLogin;
  res.json(await login(email, senha));
}

export function eu(req: Request, res: Response): void {
  const { id, nome, email, perfil } = usuarioAtual(req);
  res.json({ usuario: { id_usuario: id, nome, email, perfil } });
}

export async function alterarSenha(req: Request, res: Response): Promise<void> {
  const { senha_atual, nova_senha } = dadosValidados<{ senha_atual: string; nova_senha: string }>(req, ["body"]);
  await trocarSenha(contextoDe(req), senha_atual, nova_senha);
  res.status(204).end();
}
