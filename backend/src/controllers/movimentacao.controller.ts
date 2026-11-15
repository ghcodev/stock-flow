import type { Request, Response } from "express";
import {
  registrarEntrada,
  registrarSaida,
  registrarTransferencia,
  type DadosSaldo,
  type DadosTransferencia,
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
