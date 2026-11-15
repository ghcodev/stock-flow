import { param, query } from "express-validator";
import { lerInstante } from "../periodo.ts";
import {
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

const instante = (nome: string, rotulo: string) =>
  soEscalar(query(nome).optional(), rotulo)
    .isString()
    .withMessage(`${rotulo} inválido`)
    .bail()
    .custom((valor: string) => lerInstante(valor) !== null)
    .withMessage(`${rotulo} deve ser AAAA-MM-DD ou data e hora completas com Z ou deslocamento (+hh:mm)`);

export const validarHistorico = [
  ...validarPaginacao,
  instante("de", "Início do período"),
  instante("ate", "Fim do período"),
  query("ate")
    .optional()
    .custom((ate: string, { req }) => {
      const de = (req.query as { de?: unknown } | undefined)?.de;
      const inicio = typeof de === "string" ? lerInstante(de) : null;
      const fim = typeof ate === "string" ? lerInstante(ate) : null;
      return !inicio || !fim || inicio.momento <= fim.momento;
    })
    .withMessage("O início do período deve ser anterior ao fim"),
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
