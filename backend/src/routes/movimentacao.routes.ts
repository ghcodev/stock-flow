import { Router } from "express";
import { entrada, saida } from "../controllers/movimentacao.controller.ts";
import { exigirOperacional } from "../middlewares/perfil.middleware.ts";
import { validar } from "../middlewares/validation.middleware.ts";
import { validarEntrada, validarSaida } from "../validators/movimentacao.validator.ts";

export function criarRotasMovimentacao(): Router {
  const router = Router();
  router.use(exigirOperacional);
  router.post("/entrada", validarEntrada, validar, entrada);
  router.post("/saida", validarSaida, validar, saida);
  return router;
}
