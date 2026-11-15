import { Router } from "express";
import { health } from "../controllers/health.controller.ts";

export const healthRoutes = Router();

healthRoutes.get("/health", health);
