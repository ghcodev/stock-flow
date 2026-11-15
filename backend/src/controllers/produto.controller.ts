import type { Request, Response } from "express";
import { dadosValidados, idDaRota } from "../validators/comuns.ts";
import { contextoDe } from "../transacao.ts";
import {
  atualizarProduto,
  criarProduto,
  inativarProduto,
  listarProdutos,
  obterProduto,
  type DadosProduto,
  type FiltroProdutos,
} from "../services/produto.service.ts";

export async function criar(req: Request, res: Response): Promise<void> {
  const dados = dadosValidados<DadosProduto>(req, ["body"]);
  res.status(201).json(await criarProduto(contextoDe(req), dados));
}

export async function atualizar(req: Request, res: Response): Promise<void> {
  const dados = dadosValidados<Partial<DadosProduto>>(req, ["body"]);
  res.json(await atualizarProduto(contextoDe(req), idDaRota(req), dados));
}

export async function inativar(req: Request, res: Response): Promise<void> {
  res.json(await inativarProduto(contextoDe(req), idDaRota(req)));
}

export async function obter(req: Request, res: Response): Promise<void> {
  res.json(await obterProduto(idDaRota(req)));
}

export async function listar(req: Request, res: Response): Promise<void> {
  res.json(await listarProdutos(dadosValidados<FiltroProdutos>(req, ["query"])));
}
