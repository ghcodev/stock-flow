import type { Request, Response } from "express";
import { login } from "../services/auth.service.ts";

type CorpoLogin = { email: string; senha: string };

export async function entrar(req: Request, res: Response): Promise<void> {
  const { email, senha } = req.body as CorpoLogin;
  res.json(await login(email, senha));
}
