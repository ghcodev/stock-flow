import { Router } from "express";
import { cancelar } from "../controllers/cancelamento.controller.ts";
import { finalizar } from "../controllers/finalizacao.controller.ts";
import { contagem, contagens, contar } from "../controllers/inventario.controller.ts";
import { exigirAdministrador, exigirOperacional } from "../middlewares/perfil.middleware.ts";
import { validar } from "../middlewares/validation.middleware.ts";
import { validarContagem, validarListarContagens } from "../validators/inventario.validator.ts";
import { validarIdMovimentacao } from "../validators/movimentacao.validator.ts";

export function criarRotasInventario(): Router {
  const router = Router();
  router.use(exigirOperacional);
  router.get("/contagens", validarListarContagens, validar, contagens);
  router.post("/contagens", validarContagem, validar, contar);
  router.get("/contagens/:id", validarIdMovimentacao, validar, contagem);
  router.post("/contagens/:id/finalizar", exigirAdministrador, validarIdMovimentacao, validar, finalizar);
  router.post("/contagens/:id/cancelar", exigirAdministrador, validarIdMovimentacao, validar, cancelar);
  return router;
}
