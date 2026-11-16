import { query } from "express-validator";
import { semNul, soEscalar } from "./comuns.ts";

const MAX_ID = 2_147_483_647;

export const validarRastreabilidade = [
  soEscalar(query("numero_lote").optional(), "Número do lote")
    .isString()
    .withMessage("Número do lote inválido")
    .bail()
    .custom(semNul)
    .withMessage("Número do lote contém caractere inválido")
    .bail()
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage("Número do lote deve ter de 1 a 50 caracteres"),
  soEscalar(query("id_lote").optional(), "Lote").isInt({ min: 1, max: MAX_ID }).withMessage("Lote inválido").toInt(),
  query()
    .custom((_valor: unknown, { req }) => {
      const consulta = req.query as { numero_lote?: unknown; id_lote?: unknown } | undefined;
      return (consulta?.numero_lote !== undefined) !== (consulta?.id_lote !== undefined);
    })
    .withMessage("Informe numero_lote ou id_lote, apenas um deles"),
];
