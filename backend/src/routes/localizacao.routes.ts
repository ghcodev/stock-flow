import { Router } from "express";
import { criar, listar, obter } from "../controllers/localizacao.controller.ts";
import { exigirOperacional } from "../middlewares/perfil.middleware.ts";
import { validar } from "../middlewares/validation.middleware.ts";
import {
  validarCriarLocalizacao,
  validarIdLocalizacao,
  validarListarLocalizacoes,
} from "../validators/localizacao.validator.ts";

export function criarRotasLocalizacao(): Router {
  const router = Router();
  router.use(exigirOperacional);
  router.get("/", validarListarLocalizacoes, validar, listar);
  router.post("/", validarCriarLocalizacao, validar, criar);
  router.get("/:id", validarIdLocalizacao, validar, obter);
  return router;
}
