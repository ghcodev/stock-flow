import { query } from "express-validator";
import { decimal, idNoCorpo, soEscalar, texto, validarPaginacao } from "./comuns.ts";

const STATUS_CONTAGEM = ["pendente", "concluida", "cancelada"];
const MAX_ID = 2_147_483_647;

export const validarContagem = [
  idNoCorpo("id_lote", "Lote"),
  decimal("quantidade_contada", "Quantidade contada", true),
  texto("observacao", "Observação", 5000, false),
];

export const validarListarContagens = [
  ...validarPaginacao,
  soEscalar(query("status").optional(), "Status").isIn(STATUS_CONTAGEM).withMessage("Status inválido"),
  soEscalar(query("id_lote").optional(), "Lote").isInt({ min: 1, max: MAX_ID }).withMessage("Lote inválido").toInt(),
];
