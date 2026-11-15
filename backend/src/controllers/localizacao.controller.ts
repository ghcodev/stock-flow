import type { Request, Response } from "express";
import { contextoDe } from "../transacao.ts";
import { dadosValidados, idDaRota } from "../validators/comuns.ts";
import {
  criarLocalizacao,
  listarLocalizacoes,
  obterLocalizacao,
  type DadosLocalizacao,
  type FiltroLocalizacoes,
} from "../services/localizacao.service.ts";

export async function criar(req: Request, res: Response): Promise<void> {
  res.status(201).json(await criarLocalizacao(contextoDe(req), dadosValidados<DadosLocalizacao>(req, ["body"])));
}

export async function obter(req: Request, res: Response): Promise<void> {
  res.json(await obterLocalizacao(idDaRota(req)));
}

export async function listar(req: Request, res: Response): Promise<void> {
  res.json(await listarLocalizacoes(dadosValidados<FiltroLocalizacoes>(req, ["query"])));
}
