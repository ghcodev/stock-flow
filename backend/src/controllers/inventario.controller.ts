import type { Request, Response } from "express";
import {
  listarContagens,
  obterContagem,
  registrarContagem,
  type DadosContagem,
  type FiltroContagens,
} from "../services/inventario.service.ts";
import { contextoDe } from "../transacao.ts";
import { dadosValidados } from "../validators/comuns.ts";

const idDaContagem = (req: Request): string => dadosValidados<{ id: string }>(req, ["params"]).id;

export async function contar(req: Request, res: Response): Promise<void> {
  res.status(201).json(await registrarContagem(contextoDe(req), dadosValidados<DadosContagem>(req, ["body"])));
}

export async function contagens(req: Request, res: Response): Promise<void> {
  res.json(await listarContagens(dadosValidados<FiltroContagens>(req, ["query"])));
}

export async function contagem(req: Request, res: Response): Promise<void> {
  res.json(await obterContagem(idDaContagem(req)));
}
