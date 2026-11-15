import { Router } from "express";
import { entrada, saida, transferencia } from "../controllers/movimentacao.controller.ts";
import { exigirOperacional } from "../middlewares/perfil.middleware.ts";
import { validar } from "../middlewares/validation.middleware.ts";
import { validarEntrada, validarSaida, validarTransferencia } from "../validators/movimentacao.validator.ts";

export function criarRotasMovimentacao(): Router {
  const router = Router();
  router.use(exigirOperacional);
  router.post("/entrada", validarEntrada, validar, entrada);
  router.post("/saida", validarSaida, validar, saida);
  router.post("/transferencia", validarTransferencia, validar, transferencia);
  return router;
}
