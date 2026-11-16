import { Router } from "express";
import { alterarSenha, entrar, eu } from "../controllers/auth.controller.ts";
import { validar } from "../middlewares/validation.middleware.ts";
import { validarLogin, validarTrocaDeSenha } from "../validators/auth.validator.ts";

export function criarRotasAuthPublicas(): Router {
  const router = Router();
  router.post("/login", validarLogin, validar, entrar);
  return router;
}

export function criarRotasAuthProtegidas(): Router {
  const router = Router();
  router.get("/me", eu);
  router.post("/senha", validarTrocaDeSenha, validar, alterarSenha);
  return router;
}
