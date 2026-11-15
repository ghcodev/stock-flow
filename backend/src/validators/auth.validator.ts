import { body } from "express-validator";
import { semNul } from "./comuns.ts";

const MAX_BYTES_SENHA = 72;

export const validarLogin = [
  body("email")
    .isString()
    .withMessage("E-mail é obrigatório")
    .bail()
    .trim()
    .toLowerCase()
    .isLength({ max: 160 })
    .withMessage("E-mail deve ter no máximo 160 caracteres")
    .bail()
    .isEmail()
    .withMessage("E-mail inválido"),
  body("senha")
    .isString()
    .withMessage("Senha é obrigatória")
    .bail()
    .custom(semNul)
    .withMessage("Senha contém caractere inválido")
    .bail()
    .isLength({ min: 1 })
    .withMessage("Senha é obrigatória")
    .bail()
    .custom((valor: string) => Buffer.byteLength(valor, "utf8") <= MAX_BYTES_SENHA)
    .withMessage(`Senha deve ter no máximo ${MAX_BYTES_SENHA} bytes`),
];
