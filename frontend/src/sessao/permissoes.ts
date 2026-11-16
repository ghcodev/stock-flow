import type { Perfil } from "../api/tipos.ts";

export type Recurso =
  | "dashboard"
  | "produtos"
  | "lotes"
  | "mapa"
  | "entrada"
  | "saida"
  | "transferencia"
  | "inventario"
  | "ajuste"
  | "historico"
  | "rastreabilidade"
  | "vencimentos"
  | "usuarios"
  | "auditoria"
  | "perfil";

export type Acao = "finalizar_contagem" | "cancelar_contagem" | "exportar_vencimentos";

const SOMENTE_ADMINISTRADOR: ReadonlySet<Recurso> = new Set<Recurso>(["usuarios", "auditoria", "ajuste"]);
const ACOES_DO_ADMINISTRADOR: ReadonlySet<Acao> = new Set<Acao>([
  "finalizar_contagem",
  "cancelar_contagem",
  "exportar_vencimentos",
]);

export function podeAcessar(perfil: Perfil | null, recurso: Recurso): boolean {
  if (perfil === null) return false;
  return perfil === "administrador" || !SOMENTE_ADMINISTRADOR.has(recurso);
}

export function podeExecutar(perfil: Perfil | null, acao: Acao): boolean {
  if (perfil === null) return false;
  return perfil === "administrador" || !ACOES_DO_ADMINISTRADOR.has(acao);
}

export type DecisaoDeAcesso = "login" | "negado" | "permitido";

export function decidirAcesso(perfil: Perfil | null, recurso: Recurso | undefined): DecisaoDeAcesso {
  if (perfil === null) return "login";
  if (recurso === undefined || !podeAcessar(perfil, recurso)) return "negado";
  return "permitido";
}
