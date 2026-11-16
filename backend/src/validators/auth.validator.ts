import { body } from "express-validator";
import { campoEmail, semNul } from "./comuns.ts";

const MAX_BYTES_SENHA = 72;

export const validarLogin = [
  campoEmail(false),
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

const campoSenha = (campo: string, rotulo: string, minimo: number) =>
  body(campo)
    .isString()
    .withMessage(`${rotulo} é obrigatória`)
    .bail()
    .custom(semNul)
    .withMessage(`${rotulo} contém caractere inválido`)
    .bail()
    .isLength({ min: minimo })
    .withMessage(minimo > 1 ? `${rotulo} deve ter no mínimo ${minimo} caracteres` : `${rotulo} é obrigatória`)
    .bail()
    .custom((valor: string) => Buffer.byteLength(valor, "utf8") <= MAX_BYTES_SENHA)
    .withMessage(`${rotulo} deve ter no máximo ${MAX_BYTES_SENHA} bytes`);

export const validarTrocaDeSenha = [campoSenha("senha_atual", "Senha atual", 1), campoSenha("nova_senha", "Nova senha", 8)];
