import { body, query } from "express-validator";
import { campoBusca, dataIso, decimal, idNoCorpo, soEscalar, texto, validarId, validarPaginacao } from "./comuns.ts";
import { codigoEtiqueta, tipoEtiqueta } from "./etiqueta.validator.ts";

const MAX_ID = 2_147_483_647;
const STATUS_LOTE = ["ativo", "bloqueado", "vencido"];

const validarEtiqueta = (prefixo: string) => {
  const presente = body(prefixo).exists({ values: "null" });
  return [
    tipoEtiqueta(body(`${prefixo}.tipo`).if(presente)),
    codigoEtiqueta(body(`${prefixo}.codigo`).if(presente)),
  ];
};

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
  ...validarEtiqueta("etiqueta"),
];

export const validarBloquearLote = [validarId, texto("motivo", "Motivo", 500, true)];

export const validarIdLote = [validarId];

export const validarListarLotes = [
  ...validarPaginacao,
  soEscalar(query("id_produto").optional(), "Produto").isInt({ min: 1, max: MAX_ID }).withMessage("Produto inválido").toInt(),
  soEscalar(query("id_localizacao").optional(), "Localização").isInt({ min: 1, max: MAX_ID }).withMessage("Localização inválida").toInt(),
  campoBusca("numero_lote", "Número do lote", 50),
  campoBusca("codigo_etiqueta", "Código da etiqueta", 128).isLength({ min: 1 }).withMessage("Código da etiqueta não pode ser vazio"),
  soEscalar(query("status").optional(), "Status").isIn(STATUS_LOTE).withMessage("Status inválido"),
];
