import type { Request, Response } from "express";
import { dadosValidados } from "../validators/comuns.ts";
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

const idDe = (req: Request): number => dadosValidados<{ id: number }>(req, ["params"]).id;

export async function criar(req: Request, res: Response): Promise<void> {
  const dados = dadosValidados<DadosProduto>(req, ["body"]);
  res.status(201).json(await criarProduto(contextoDe(req), dados));
}

export async function atualizar(req: Request, res: Response): Promise<void> {
  const dados = dadosValidados<Partial<DadosProduto>>(req, ["body"]);
  res.json(await atualizarProduto(contextoDe(req), idDe(req), dados));
}

export async function inativar(req: Request, res: Response): Promise<void> {
  res.json(await inativarProduto(contextoDe(req), idDe(req)));
}

export async function obter(req: Request, res: Response): Promise<void> {
  res.json(await obterProduto(idDe(req)));
}

export async function listar(req: Request, res: Response): Promise<void> {
  res.json(await listarProdutos(dadosValidados<FiltroProdutos>(req, ["query"])));
}
