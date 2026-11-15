import { Router } from "express";
import { atualizar, criar, inativar, listar, obter } from "../controllers/usuario.controller.ts";
import { exigirAdministrador } from "../middlewares/perfil.middleware.ts";
import { validar } from "../middlewares/validation.middleware.ts";
import {
  validarAtualizarUsuario,
  validarCriarUsuario,
  validarIdUsuario,
  validarListarUsuarios,
} from "../validators/usuario.validator.ts";

export function criarRotasUsuario(): Router {
  const router = Router();
  router.use(exigirAdministrador);
  router.get("/", validarListarUsuarios, validar, listar);
  router.post("/", validarCriarUsuario, validar, criar);
  router.get("/:id", validarIdUsuario, validar, obter);
  router.patch("/:id", validarAtualizarUsuario, validar, atualizar);
  router.post("/:id/inativar", validarIdUsuario, validar, inativar);
  return router;
}
