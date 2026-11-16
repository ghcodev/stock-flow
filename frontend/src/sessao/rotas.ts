import { matchRoutes } from "react-router";
import type { Perfil } from "../api/tipos.ts";
import { ITENS_DE_MENU } from "./navegacao.ts";
import { podeAcessar, type Recurso } from "./permissoes.ts";

type DefinicaoDeRota = { path: string; caseSensitive: boolean; id: string };

export const ROTAS_DECLARADAS: readonly DefinicaoDeRota[] = ITENS_DE_MENU.map((item) => ({
  path: item.caminho,
  caseSensitive: true,
  id: item.recurso,
}));

const RECURSOS = new Set<string>(ITENS_DE_MENU.map((item) => item.recurso));

export function recursoDoCaminho(caminho: string): Recurso | undefined {
  const casamentos = matchRoutes([...ROTAS_DECLARADAS, { path: "*", id: "*" }], caminho);
  const id = casamentos?.[casamentos.length - 1]?.route.id;
  return id !== undefined && RECURSOS.has(id) ? (id as Recurso) : undefined;
}

const RECURSOS_COM_LEITOR: ReadonlySet<Recurso> = new Set<Recurso>(["lotes", "entrada", "saida", "transferencia", "inventario", "ajuste", "rastreabilidade"]);

export function capturaPermitida(perfil: Perfil | null, caminho: string): boolean {
  if (perfil === null) return false;
  const recurso = recursoDoCaminho(caminho);
  return recurso !== undefined && RECURSOS_COM_LEITOR.has(recurso) && podeAcessar(perfil, recurso);
}
