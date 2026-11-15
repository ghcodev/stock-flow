import type { Request, Response } from "express";
import type { perfil_usuario } from "../generated/prisma/enums.ts";
import {
  atualizarUsuario,
  criarUsuario,
  inativarUsuario,
  listarUsuarios,
  obterUsuario,
  type DadosNovoUsuario,
  type FiltroUsuarios,
} from "../services/usuario.service.ts";
import { contextoDe } from "../transacao.ts";
import { dadosValidados } from "../validators/comuns.ts";

const idDe = (req: Request): number => dadosValidados<{ id: number }>(req, ["params"]).id;

export async function criar(req: Request, res: Response): Promise<void> {
  res.status(201).json(await criarUsuario(contextoDe(req), dadosValidados<DadosNovoUsuario>(req, ["body"])));
}

export async function atualizar(req: Request, res: Response): Promise<void> {
  const dados = dadosValidados<{ nome?: string; email?: string; perfil?: perfil_usuario; senha?: string }>(req, ["body"]);
  res.json(await atualizarUsuario(contextoDe(req), idDe(req), dados));
}

export async function inativar(req: Request, res: Response): Promise<void> {
  res.json(await inativarUsuario(contextoDe(req), idDe(req)));
}

export async function obter(req: Request, res: Response): Promise<void> {
  res.json(await obterUsuario(idDe(req)));
}

export async function listar(req: Request, res: Response): Promise<void> {
  res.json(await listarUsuarios(dadosValidados<FiltroUsuarios>(req, ["query"])));
}
