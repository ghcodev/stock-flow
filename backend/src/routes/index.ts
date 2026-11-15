import { Router } from "express";
import { healthRoutes } from "./health.routes.ts";
import { criarRotasAuthPublicas } from "./auth.routes.ts";

export function criarRotasPublicas(): Router {
  const router = Router();
  router.use(healthRoutes);
  router.use("/auth", criarRotasAuthPublicas());
  return router;
}
