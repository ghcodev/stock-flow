import { query } from "express-validator";
import { algumCampo, decimal, texto, validarId, validarPaginacao } from "./comuns.ts";

const CAMPOS = ["nome", "categoria", "descricao", "unidade_medida", "estoque_minimo"];

export const validarCriarProduto = [
  texto("nome", "Nome", 120, true),
  texto("categoria", "Categoria", 60, false),
  texto("descricao", "Descrição", 5000, false),
  texto("unidade_medida", "Unidade de medida", 10, true),
  decimal("estoque_minimo", "Estoque mínimo", false),
];

export const validarAtualizarProduto = [
  validarId,
  algumCampo(CAMPOS),
  texto("nome", "Nome", 120, true).optional(),
  texto("categoria", "Categoria", 60, false),
  texto("descricao", "Descrição", 5000, false),
  texto("unidade_medida", "Unidade de medida", 10, true).optional(),
  decimal("estoque_minimo", "Estoque mínimo", false),
];

export const validarListarProdutos = [
  ...validarPaginacao,
  query("busca").optional().isString().withMessage("Busca inválida").trim().isLength({ max: 100 }).withMessage("Busca deve ter até 100 caracteres"),
  query("ativo").optional().isBoolean().withMessage("Filtro ativo inválido").toBoolean(),
];

export const validarIdProduto = [validarId];
