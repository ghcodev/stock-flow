import { Router } from "express";
import {
  bloquear,
  criar,
  desbloquear,
  listar,
  obter,
} from "../controllers/lote.controller.ts";
import { associar } from "../controllers/etiqueta.controller.ts";
import { exigirOperacional } from "../middlewares/perfil.middleware.ts";
import { validar } from "../middlewares/validation.middleware.ts";
import { validarAssociarEtiqueta } from "../validators/etiqueta.validator.ts";
import {
  validarBloquearLote,
  validarCriarLote,
  validarIdLote,
  validarListarLotes,
} from "../validators/lote.validator.ts";

export function criarRotasLote(): Router {
  const router = Router();
  router.use(exigirOperacional);
  router.get("/", validarListarLotes, validar, listar);
  router.post("/", validarCriarLote, validar, criar);
  router.get("/:id", validarIdLote, validar, obter);
  router.post("/:id/bloquear", validarBloquearLote, validar, bloquear);
  router.post("/:id/desbloquear", validarIdLote, validar, desbloquear);
  router.post("/:id/etiqueta", validarAssociarEtiqueta, validar, associar);
  return router;
}
