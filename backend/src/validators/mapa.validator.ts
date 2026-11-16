import { query } from "express-validator";
import { semNul, soEscalar, validarPaginacao } from "./comuns.ts";

export const validarMapa = [
  ...validarPaginacao,
  soEscalar(query("corredor").optional(), "Corredor")
    .isString()
    .withMessage("Corredor inválido")
    .bail()
    .custom(semNul)
    .withMessage("Corredor contém caractere inválido")
    .bail()
    .trim()
    .isLength({ min: 1, max: 10 })
    .withMessage("Corredor deve ter de 1 a 10 caracteres"),
];
