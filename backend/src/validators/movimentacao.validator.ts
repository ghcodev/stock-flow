import { param, query } from "express-validator";
import {
  idNoCorpo,
  quantidadePositiva,
  soEscalar,
  texto,
  validarPaginacao,
} from "./comuns.ts";

const TIPOS_MOVIMENTACAO = ["entrada", "saida", "transferencia", "ajuste", "inventario"];
const MAX_ID = 2_147_483_647;

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

const instante = (nome: string, rotulo: string) =>
  soEscalar(query(nome).optional(), rotulo)
    .isString()
    .withMessage(`${rotulo} inválido`)
    .bail()
    .isISO8601({ strict: true, strictSeparator: true })
    .withMessage(`${rotulo} deve ser uma data ou data e hora ISO 8601`);

export const validarHistorico = [
  ...validarPaginacao,
  instante("de", "Início do período"),
  instante("ate", "Fim do período"),
  query("ate")
    .optional()
    .custom((ate: string, { req }) => {
      const de = (req.query as { de?: unknown } | undefined)?.de;
      return typeof de !== "string" || typeof ate !== "string" || new Date(de) <= new Date(ate);
    })
    .withMessage("O início do período deve ser anterior ao fim"),
  soEscalar(query("tipo").optional(), "Tipo").isIn(TIPOS_MOVIMENTACAO).withMessage("Tipo inválido"),
  soEscalar(query("id_lote").optional(), "Lote").isInt({ min: 1, max: MAX_ID }).withMessage("Lote inválido").toInt(),
  soEscalar(query("id_usuario").optional(), "Usuário")
    .isInt({ min: 1, max: MAX_ID })
    .withMessage("Usuário inválido")
    .toInt(),
];

export const validarIdMovimentacao = [
  soEscalar(param("id"), "Identificador")
    .matches(/^[1-9]\d{0,17}$/)
    .withMessage("Identificador inválido"),
];

