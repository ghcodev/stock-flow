import { isIP } from "node:net";
import { query } from "express-validator";
import { lerFiltroJson } from "../filtro-json.ts";
import { semNul, soEscalar, validarPaginacao } from "./comuns.ts";
import { validarPeriodoDeConsulta } from "./periodo.validator.ts";

const MAX_ID = 2_147_483_647;
const ID_BIGINT = /^[1-9]\d{0,17}$/;
export const TABELAS_AUDITADAS = ["lote", "movimentacao", "usuario"];
export const OPERACOES_AUDITADAS = ["INSERT", "UPDATE", "DELETE"];

const conteudo = (nome: string, rotulo: string) =>
  soEscalar(query(nome).optional(), rotulo)
    .isString()
    .withMessage(`${rotulo} inválido`)
    .bail()
    .custom((valor: string) => lerFiltroJson(valor) !== null)
    .withMessage(`${rotulo} deve ser um objeto JSON simples (até 512 caracteres, 3 níveis e 20 chaves, sem senha_hash)`);

export const validarAuditoria = [
  ...validarPaginacao,
  ...validarPeriodoDeConsulta,
  soEscalar(query("antes_de_id").optional(), "Cursor").matches(ID_BIGINT).withMessage("Cursor inválido"),
  soEscalar(query("id_usuario").optional(), "Usuário")
    .isInt({ min: 1, max: MAX_ID })
    .withMessage("Usuário inválido")
    .toInt(),
  soEscalar(query("tabela").optional(), "Tabela").isIn(TABELAS_AUDITADAS).withMessage("Tabela inválida"),
  soEscalar(query("operacao").optional(), "Operação").isIn(OPERACOES_AUDITADAS).withMessage("Operação inválida"),
  soEscalar(query("ip").optional(), "IP")
    .isString()
    .withMessage("IP inválido")
    .bail()
    .custom((valor: string) => semNul(valor) && valor.length <= 45 && isIP(valor) !== 0)
    .withMessage("IP inválido"),
  conteudo("valor_novo", "Filtro de valor novo"),
  conteudo("valor_anterior", "Filtro de valor anterior"),
];
