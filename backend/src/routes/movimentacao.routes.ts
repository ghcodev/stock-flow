import { Router } from "express";
import { ajuste, entrada, historico, obter, saida, transferencia } from "../controllers/movimentacao.controller.ts";
import { exigirAdministrador, exigirOperacional } from "../middlewares/perfil.middleware.ts";
import { validar } from "../middlewares/validation.middleware.ts";
import {
  validarAjuste,
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
  router.post("/ajuste", exigirAdministrador, validarAjuste, validar, ajuste);
  router.post("/transferencia", validarTransferencia, validar, transferencia);
  return router;
}
