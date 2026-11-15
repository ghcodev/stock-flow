import type { Request, Response } from "express";
import { usuarioAtual } from "../middlewares/auth.middleware.ts";
import { login } from "../services/auth.service.ts";

type CorpoLogin = { email: string; senha: string };

export async function entrar(req: Request, res: Response): Promise<void> {
  const { email, senha } = req.body as CorpoLogin;
  res.json(await login(email, senha));
}

export function eu(req: Request, res: Response): void {
  const { id, nome, email, perfil } = usuarioAtual(req);
  res.json({ usuario: { id_usuario: id, nome, email, perfil } });
}
