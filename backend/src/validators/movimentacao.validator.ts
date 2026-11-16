import { param, query } from "express-validator";
import { validarPeriodoDeConsulta } from "./periodo.validator.ts";
import {
  decimal,
  idNoCorpo,
  quantidadePositiva,
  soEscalar,
  texto,
  validarPaginacao,
} from "./comuns.ts";

const TIPOS_MOVIMENTACAO = ["entrada", "saida", "transferencia", "ajuste", "inventario"];
const MAX_ID = 2_147_483_647;
const ID_BIGINT = /^[1-9]\d{0,17}$/;

const camposDeSaldo = [
  idNoCorpo("id_lote", "Lote"),
  quantidadePositiva("quantidade", "Quantidade"),
  texto("motivo", "Motivo", 255, false),
  texto("observacao", "Observação", 5000, false),
];

export const validarEntrada = camposDeSaldo;

export const validarSaida = camposDeSaldo;

export const validarTransferencia = [
  idNoCorpo("id_lote", "Lote"),
  idNoCorpo("id_localizacao_destino", "Localização de destino"),
  texto("motivo", "Justificativa", 255, true),
  texto("observacao", "Observação", 5000, false),
];

export const validarHistorico = [
  ...validarPaginacao,
  ...validarPeriodoDeConsulta,
  soEscalar(query("antes_de_id").optional(), "Cursor").matches(ID_BIGINT).withMessage("Cursor inválido"),
  soEscalar(query("tipo").optional(), "Tipo").isIn(TIPOS_MOVIMENTACAO).withMessage("Tipo inválido"),
  soEscalar(query("id_lote").optional(), "Lote").isInt({ min: 1, max: MAX_ID }).withMessage("Lote inválido").toInt(),
  soEscalar(query("id_usuario").optional(), "Usuário")
    .isInt({ min: 1, max: MAX_ID })
    .withMessage("Usuário inválido")
    .toInt(),
];

export const validarIdMovimentacao = [
  soEscalar(param("id"), "Identificador").matches(ID_BIGINT).withMessage("Identificador inválido"),
];

export const validarAjuste = [
  idNoCorpo("id_lote", "Lote"),
  decimal("saldo_exibido", "Saldo exibido", true),
  decimal("novo_saldo", "Novo saldo", true),
  texto("motivo", "Justificativa", 255, true, 10),
];
