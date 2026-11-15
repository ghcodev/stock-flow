import type { Request, Response } from "express";
import {
  listarHistorico,
  obterMovimentacao,
  registrarEntrada,
  registrarSaida,
  registrarTransferencia,
  type DadosSaldo,
  type DadosTransferencia,
  type FiltroHistorico,
} from "../services/movimentacao.service.ts";
import { contextoDe } from "../transacao.ts";
import { dadosValidados } from "../validators/comuns.ts";

export async function entrada(req: Request, res: Response): Promise<void> {
  res.status(201).json(await registrarEntrada(contextoDe(req), dadosValidados<DadosSaldo>(req, ["body"])));
}

export async function saida(req: Request, res: Response): Promise<void> {
  res.status(201).json(await registrarSaida(contextoDe(req), dadosValidados<DadosSaldo>(req, ["body"])));
}

export async function transferencia(req: Request, res: Response): Promise<void> {
  res.status(201).json(await registrarTransferencia(contextoDe(req), dadosValidados<DadosTransferencia>(req, ["body"])));
}

export async function historico(req: Request, res: Response): Promise<void> {
  res.json(await listarHistorico(dadosValidados<FiltroHistorico>(req, ["query"])));
}

export async function obter(req: Request, res: Response): Promise<void> {
  res.json(await obterMovimentacao(dadosValidados<{ id: string }>(req, ["params"]).id));
}
