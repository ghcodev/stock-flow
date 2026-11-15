import type { Request, Response } from "express";
import { contextoDe } from "../transacao.ts";
import { dadosValidados, idDaRota } from "../validators/comuns.ts";
import {
  bloquearLote,
  criarLote,
  desbloquearLote,
  listarLotes,
  obterLote,
  type DadosLote,
  type FiltroLotes,
} from "../services/lote.service.ts";

export async function criar(req: Request, res: Response): Promise<void> {
  res.status(201).json(await criarLote(contextoDe(req), dadosValidados<DadosLote>(req, ["body"])));
}

export async function obter(req: Request, res: Response): Promise<void> {
  res.json(await obterLote(idDaRota(req)));
}

export async function listar(req: Request, res: Response): Promise<void> {
  res.json(await listarLotes(dadosValidados<FiltroLotes>(req, ["query"])));
}

export async function bloquear(req: Request, res: Response): Promise<void> {
  const { motivo } = dadosValidados<{ motivo: string }>(req, ["body"]);
  res.json(await bloquearLote(contextoDe(req), idDaRota(req), motivo));
}

export async function desbloquear(req: Request, res: Response): Promise<void> {
  res.json(await desbloquearLote(contextoDe(req), idDaRota(req)));
}
