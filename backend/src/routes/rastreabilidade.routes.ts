import { Router } from "express";
import { rastreabilidade } from "../controllers/rastreabilidade.controller.ts";
import { exigirOperacional } from "../middlewares/perfil.middleware.ts";
import { validar } from "../middlewares/validation.middleware.ts";
import { validarRastreabilidade } from "../validators/rastreabilidade.validator.ts";

export function criarRotasRastreabilidade(): Router {
  const router = Router();
  router.use(exigirOperacional);
  router.get("/", validarRastreabilidade, validar, rastreabilidade);
  return router;
}
