import { Router } from "express";
import { healthRoutes } from "./health.routes.ts";
import { criarRotasAuthProtegidas, criarRotasAuthPublicas } from "./auth.routes.ts";
import { criarRotasProduto } from "./produto.routes.ts";
import { criarRotasLocalizacao } from "./localizacao.routes.ts";
import { criarRotasLote } from "./lote.routes.ts";
import { criarRotasUsuario } from "./usuario.routes.ts";
import { criarRotasMovimentacao } from "./movimentacao.routes.ts";

export function criarRotasPublicas(): Router {
  const router = Router();
  router.use(healthRoutes);
  router.use("/auth", criarRotasAuthPublicas());
  return router;
}

export function criarRotasProtegidas(): Router {
  const router = Router();
  router.use("/auth", criarRotasAuthProtegidas());
  router.use("/produtos", criarRotasProduto());
  router.use("/localizacoes", criarRotasLocalizacao());
  router.use("/lotes", criarRotasLote());
  router.use("/usuarios", criarRotasUsuario());
  router.use("/movimentacoes", criarRotasMovimentacao());
  return router;
}
