import { query } from "express-validator";
import { decimal, texto, validarId, validarPaginacao } from "./comuns.ts";

export const validarCriarLocalizacao = [
  texto("corredor", "Corredor", 10, true),
  texto("nivel", "Nível", 10, true),
  texto("posicao", "Posição", 10, true),
  texto("descricao", "Descrição", 120, false),
  decimal("capacidade", "Capacidade", false),
];

export const validarListarLocalizacoes = [
  ...validarPaginacao,
  query("busca")
    .optional()
    .isString()
    .withMessage("Busca inválida")
    .trim()
    .isLength({ max: 100 })
    .withMessage("Busca deve ter até 100 caracteres"),
];

export const validarIdLocalizacao = [validarId];
