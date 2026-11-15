import { body, query } from "express-validator";
import { campoBusca, semNul, dataIso, decimal, soEscalar, texto, validarId, validarPaginacao } from "./comuns.ts";
import { TIPOS_ETIQUETA } from "./etiqueta.validator.ts";

const MAX_ID = 2_147_483_647;
const STATUS_LOTE = ["ativo", "bloqueado", "vencido"];

function idNoCorpo(campo: string, rotulo: string) {
  return soEscalar(body(campo), rotulo)
    .isInt({ min: 1, max: MAX_ID })
    .withMessage(`${rotulo} é obrigatório e deve ser um identificador válido`)
    .toInt();
}

export const validarEtiqueta = (prefixo: string, obrigatoria: boolean) => [
  soEscalar(
    body(`${prefixo}.tipo`).if(obrigatoria ? body(prefixo).exists() : body(prefixo).exists({ values: "null" })),
    "Tipo de etiqueta",
  ).isIn(TIPOS_ETIQUETA)
    .withMessage("Tipo de etiqueta deve ser qr_code ou rfid"),
  body(`${prefixo}.codigo`)
    .if(obrigatoria ? body(prefixo).exists() : body(prefixo).exists({ values: "null" }))
    .isString()
    .withMessage("Código da etiqueta deve ser texto")
    .bail()
    .custom(semNul)
    .withMessage("Código da etiqueta contém caractere inválido")
    .bail()
    .trim()
    .isLength({ min: 1, max: 128 })
    .withMessage("Código da etiqueta é obrigatório e deve ter até 128 caracteres"),
];

export const validarCriarLote = [
  texto("numero_lote", "Número do lote", 50, true),
  idNoCorpo("id_produto", "Produto"),
  idNoCorpo("id_localizacao", "Localização"),
  decimal("quantidade", "Quantidade", false),
  dataIso("data_fabricacao", "Data de fabricação"),
  dataIso("data_validade", "Data de validade"),
  body("data_validade")
    .optional({ values: "null" })
    .custom((validade: string, { req }) => {
      const fabricacao = (req.body as { data_fabricacao?: unknown }).data_fabricacao;
      return typeof fabricacao !== "string" || validade >= fabricacao;
    })
    .withMessage("Data de validade não pode ser anterior à fabricação"),
  body("etiqueta").optional({ values: "null" }).isObject().withMessage("Etiqueta deve ser um objeto"),
  ...validarEtiqueta("etiqueta", false),
];

export const validarBloquearLote = [validarId, texto("motivo", "Motivo", 500, true)];

export const validarIdLote = [validarId];

export const validarListarLotes = [
  ...validarPaginacao,
  soEscalar(query("id_produto").optional(), "Produto").isInt({ min: 1, max: MAX_ID }).withMessage("Produto inválido").toInt(),
  soEscalar(query("id_localizacao").optional(), "Localização").isInt({ min: 1, max: MAX_ID }).withMessage("Localização inválida").toInt(),
  campoBusca("numero_lote", "Número do lote", 50),
  soEscalar(query("status").optional(), "Status").isIn(STATUS_LOTE).withMessage("Status inválido"),
];
