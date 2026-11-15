import { Router } from "express";
import { entrar } from "../controllers/auth.controller.ts";
import { criarLimiteLogin } from "../middlewares/rate-limit.middleware.ts";
import { validar } from "../middlewares/validation.middleware.ts";
import { validarLogin } from "../validators/auth.validator.ts";

export function criarRotasAuthPublicas(): Router {
  const router = Router();
  router.post("/login", criarLimiteLogin(), validarLogin, validar, entrar);
  return router;
}
