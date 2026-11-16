import { body, query } from "express-validator";
import {
  algumCampo,
  campoBusca,
  campoEmail,
  campoSenha,
  MIN_CARACTERES_SENHA,
  soEscalar,
  texto,
  validarId,
  validarPaginacao,
} from "./comuns.ts";

const PERFIS = ["administrador", "operador"];

const perfil = (opcional: boolean) => {
  const base = body("perfil");
  return soEscalar(opcional ? base.optional() : base, "Perfil")
    .isIn(PERFIS)
    .withMessage("Perfil deve ser administrador ou operador");
};

export const validarCriarUsuario = [texto("nome", "Nome", 120, true), campoEmail(false), campoSenha("senha", "Senha", MIN_CARACTERES_SENHA), perfil(false)];

export const validarAtualizarUsuario = [
  validarId,
  algumCampo(["nome", "email", "senha", "perfil"]),
  texto("nome", "Nome", 120, true).optional(),
  campoEmail(true),
  campoSenha("senha", "Senha", MIN_CARACTERES_SENHA, true),
  perfil(true),
];

export const validarIdUsuario = [validarId];

export const validarListarUsuarios = [
  ...validarPaginacao,
  campoBusca("busca", "Busca", 100),
  soEscalar(query("perfil").optional(), "Perfil").isIn(PERFIS).withMessage("Perfil inválido"),
  soEscalar(query("ativo").optional(), "Filtro ativo").isBoolean().withMessage("Filtro ativo inválido").toBoolean(),
];
