import { query } from "express-validator";
import { campoBusca, decimal, texto, validarId, validarPaginacao } from "./comuns.ts";

export const validarCriarLocalizacao = [
  texto("corredor", "Corredor", 10, true),
  texto("nivel", "Nível", 10, true),
  texto("posicao", "Posição", 10, true),
  texto("descricao", "Descrição", 120, false),
  decimal("capacidade", "Capacidade", false),
];

export const validarListarLocalizacoes = [
  ...validarPaginacao,
  campoBusca("busca", "Busca", 100),
];

export const validarIdLocalizacao = [validarId];
