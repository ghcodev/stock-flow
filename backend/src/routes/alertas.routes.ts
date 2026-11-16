import { Router } from "express";
import { exportacao, vencimentos } from "../controllers/alertas.controller.ts";
import { exigirAdministrador, exigirOperacional } from "../middlewares/perfil.middleware.ts";
import { validar } from "../middlewares/validation.middleware.ts";
import { validarPaginacao } from "../validators/comuns.ts";

export function criarRotasAlertas(): Router {
  const router = Router();
  router.use(exigirOperacional);
  router.get("/vencimento", validarPaginacao, validar, vencimentos);
  router.get("/vencimento/exportacao", exigirAdministrador, exportacao);
  return router;
}
