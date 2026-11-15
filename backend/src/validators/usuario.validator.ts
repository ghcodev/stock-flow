import { body, query } from "express-validator";
import { algumCampo, campoBusca, campoEmail, semNul, soEscalar, texto, validarId, validarPaginacao } from "./comuns.ts";

const PERFIS = ["administrador", "operador"];
const MIN_SENHA = 8;
const MAX_BYTES_SENHA = 72;

const senha = (opcional: boolean) => {
  const base = body("senha");
  return (opcional ? base.optional() : base)
    .isString()
    .withMessage("Senha é obrigatória")
    .bail()
    .custom(semNul)
    .withMessage("Senha contém caractere inválido")
    .bail()
    .isLength({ min: MIN_SENHA })
    .withMessage(`Senha deve ter no mínimo ${MIN_SENHA} caracteres`)
    .bail()
    .custom((valor: string) => Buffer.byteLength(valor, "utf8") <= MAX_BYTES_SENHA)
    .withMessage(`Senha deve ter no máximo ${MAX_BYTES_SENHA} bytes`);
};

const perfil = (opcional: boolean) => {
  const base = body("perfil");
  return soEscalar(opcional ? base.optional() : base, "Perfil")
    .isIn(PERFIS)
    .withMessage("Perfil deve ser administrador ou operador");
};

export const validarCriarUsuario = [texto("nome", "Nome", 120, true), campoEmail(false), senha(false), perfil(false)];

export const validarAtualizarUsuario = [
  validarId,
  algumCampo(["nome", "email", "senha", "perfil"]),
  texto("nome", "Nome", 120, true).optional(),
  campoEmail(true),
  senha(true),
  perfil(true),
];

export const validarIdUsuario = [validarId];

export const validarListarUsuarios = [
  ...validarPaginacao,
  campoBusca("busca", "Busca", 100),
  soEscalar(query("perfil").optional(), "Perfil").isIn(PERFIS).withMessage("Perfil inválido"),
  soEscalar(query("ativo").optional(), "Filtro ativo").isBoolean().withMessage("Filtro ativo inválido").toBoolean(),
];
