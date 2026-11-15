import { Router } from "express";
import { healthRoutes } from "./health.routes.ts";

export const routes = Router();

routes.use(healthRoutes);
