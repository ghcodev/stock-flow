import { Router } from "express";
import { entrada } from "../controllers/movimentacao.controller.ts";
import { exigirOperacional } from "../middlewares/perfil.middleware.ts";
import { validar } from "../middlewares/validation.middleware.ts";
import { validarEntrada } from "../validators/movimentacao.validator.ts";

export function criarRotasMovimentacao(): Router {
  const router = Router();
  router.use(exigirOperacional);
  router.post("/entrada", validarEntrada, validar, entrada);
  return router;
}
