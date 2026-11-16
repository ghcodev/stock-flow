import { Router } from "express";
import { auditoria } from "../controllers/auditoria.controller.ts";
import { exigirAdministrador } from "../middlewares/perfil.middleware.ts";
import { validar } from "../middlewares/validation.middleware.ts";
import { validarAuditoria } from "../validators/auditoria.validator.ts";

export function criarRotasAuditoria(): Router {
  const router = Router();
  router.use(exigirAdministrador);
  router.get("/", validarAuditoria, validar, auditoria);
  return router;
}
