import { query } from "express-validator";
import { algumCampo, campoBusca, decimal, soEscalar, texto, validarId, validarPaginacao } from "./comuns.ts";

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
  campoBusca("busca", "Busca", 100),
  soEscalar(query("ativo").optional(), "Filtro ativo").isBoolean().withMessage("Filtro ativo inválido").toBoolean(),
];

export const validarIdProduto = [validarId];
