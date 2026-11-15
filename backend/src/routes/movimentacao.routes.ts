import { Router } from "express";
import { entrada, historico, obter, saida, transferencia } from "../controllers/movimentacao.controller.ts";
import { exigirOperacional } from "../middlewares/perfil.middleware.ts";
import { validar } from "../middlewares/validation.middleware.ts";
import {
  validarEntrada,
  validarHistorico,
  validarIdMovimentacao,
  validarSaida,
  validarTransferencia,
} from "../validators/movimentacao.validator.ts";

export function criarRotasMovimentacao(): Router {
  const router = Router();
  router.use(exigirOperacional);
  router.get("/", validarHistorico, validar, historico);
  router.get("/:id", validarIdMovimentacao, validar, obter);
  router.post("/entrada", validarEntrada, validar, entrada);
  router.post("/saida", validarSaida, validar, saida);
  router.post("/transferencia", validarTransferencia, validar, transferencia);
  return router;
}
