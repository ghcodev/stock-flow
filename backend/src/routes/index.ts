import { Router } from "express";
import { healthRoutes } from "./health.routes.ts";
import { criarRotasAuthProtegidas, criarRotasAuthPublicas } from "./auth.routes.ts";

export function criarRotasPublicas(): Router {
  const router = Router();
  router.use(healthRoutes);
  router.use("/auth", criarRotasAuthPublicas());
  return router;
}

export function criarRotasProtegidas(): Router {
  const router = Router();
  router.use("/auth", criarRotasAuthProtegidas());
  return router;
}
