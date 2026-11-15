import { Router } from "express";
import { atualizar, criar, inativar, listar, obter } from "../controllers/produto.controller.ts";
import { exigirOperacional } from "../middlewares/perfil.middleware.ts";
import { validar } from "../middlewares/validation.middleware.ts";
import {
  validarAtualizarProduto,
  validarCriarProduto,
  validarIdProduto,
  validarListarProdutos,
} from "../validators/produto.validator.ts";

export function criarRotasProduto(): Router {
  const router = Router();
  router.use(exigirOperacional);
  router.get("/", validarListarProdutos, validar, listar);
  router.post("/", validarCriarProduto, validar, criar);
  router.get("/:id", validarIdProduto, validar, obter);
  router.patch("/:id", validarAtualizarProduto, validar, atualizar);
  router.post("/:id/inativar", validarIdProduto, validar, inativar);
  return router;
}
