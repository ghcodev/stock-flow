import { Router } from "express";
import { mapa } from "../controllers/mapa.controller.ts";
import { exigirOperacional } from "../middlewares/perfil.middleware.ts";
import { validar } from "../middlewares/validation.middleware.ts";
import { validarMapa } from "../validators/mapa.validator.ts";

export function criarRotasMapa(): Router {
  const router = Router();
  router.use(exigirOperacional);
  router.get("/", validarMapa, validar, mapa);
  return router;
}
