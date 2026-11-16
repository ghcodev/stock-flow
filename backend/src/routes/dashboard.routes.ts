import { Router } from "express";
import { dashboard } from "../controllers/dashboard.controller.ts";
import { exigirOperacional } from "../middlewares/perfil.middleware.ts";

export function criarRotasDashboard(): Router {
  const router = Router();
  router.use(exigirOperacional);
  router.get("/", dashboard);
  return router;
}
