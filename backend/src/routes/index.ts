import { Router } from "express";
import { healthRoutes } from "./health.routes.ts";
import { criarRotasAuthProtegidas, criarRotasAuthPublicas } from "./auth.routes.ts";
import { criarRotasProduto } from "./produto.routes.ts";
import { criarRotasLocalizacao } from "./localizacao.routes.ts";
import { criarRotasLote } from "./lote.routes.ts";
import { criarRotasUsuario } from "./usuario.routes.ts";
import { criarRotasMovimentacao } from "./movimentacao.routes.ts";
import { criarRotasInventario } from "./inventario.routes.ts";
import { criarRotasAuditoria } from "./auditoria.routes.ts";
import { criarRotasRastreabilidade } from "./rastreabilidade.routes.ts";
import { criarRotasDashboard } from "./dashboard.routes.ts";
import { criarRotasAlertas } from "./alertas.routes.ts";
import { criarRotasMapa } from "./mapa.routes.ts";

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
  router.use("/inventario", criarRotasInventario());
  router.use("/auditoria", criarRotasAuditoria());
  router.use("/rastreabilidade", criarRotasRastreabilidade());
  router.use("/dashboard", criarRotasDashboard());
  router.use("/alertas", criarRotasAlertas());
  router.use("/mapa", criarRotasMapa());
  return router;
}
