import type { Perfil } from "../api/tipos.ts";
import { podeAcessar, type Recurso } from "./permissoes.ts";

export type ItemDeMenu = {
  recurso: Recurso;
  rotulo: string;
  caminho: string;
  icone: string;
  grupo: string;
};

export type GrupoDeMenu = {
  rotulo: string;
  itens: ItemDeMenu[];
};

export const ITENS_DE_MENU: readonly ItemDeMenu[] = [
  { recurso: "dashboard", rotulo: "Dashboard", caminho: "/", icone: "home", grupo: "Operação" },
  { recurso: "produtos", rotulo: "Produtos", caminho: "/produtos", icone: "package", grupo: "Operação" },
  { recurso: "lotes", rotulo: "Lotes", caminho: "/lotes", icone: "layers", grupo: "Operação" },
  { recurso: "mapa", rotulo: "Mapa do Armazém", caminho: "/mapa", icone: "map", grupo: "Operação" },
  { recurso: "entrada", rotulo: "Entrada", caminho: "/entrada", icone: "arrow-down-left", grupo: "Movimentações" },
  { recurso: "saida", rotulo: "Saída", caminho: "/saida", icone: "arrow-up-right", grupo: "Movimentações" },
  { recurso: "transferencia", rotulo: "Transferência", caminho: "/transferencia", icone: "shuffle", grupo: "Movimentações" },
  { recurso: "inventario", rotulo: "Inventário", caminho: "/inventario", icone: "clipboard", grupo: "Movimentações" },
  { recurso: "ajuste", rotulo: "Ajuste de estoque", caminho: "/ajuste", icone: "sliders", grupo: "Movimentações" },
  { recurso: "historico", rotulo: "Histórico", caminho: "/historico", icone: "history", grupo: "Análise" },
  { recurso: "rastreabilidade", rotulo: "Rastreabilidade", caminho: "/rastreabilidade", icone: "scan", grupo: "Análise" },
  { recurso: "vencimentos", rotulo: "Vencimentos", caminho: "/vencimentos", icone: "clock", grupo: "Análise" },
  { recurso: "usuarios", rotulo: "Usuários", caminho: "/usuarios", icone: "users", grupo: "Administração" },
  { recurso: "auditoria", rotulo: "Auditoria", caminho: "/auditoria", icone: "shield", grupo: "Administração" },
  { recurso: "perfil", rotulo: "Meu Perfil", caminho: "/perfil", icone: "user", grupo: "Conta" },
];

export function menuDoPerfil(perfil: Perfil | null): GrupoDeMenu[] {
  const grupos: GrupoDeMenu[] = [];
  for (const item of ITENS_DE_MENU) {
    if (!podeAcessar(perfil, item.recurso)) continue;
    const grupo = grupos.find((g) => g.rotulo === item.grupo);
    if (grupo) grupo.itens.push(item);
    else grupos.push({ rotulo: item.grupo, itens: [item] });
  }
  return grupos;
}

export function itemDoCaminho(caminho: string): ItemDeMenu | undefined {
  const limpo = caminho.length > 1 ? caminho.replace(/\/+$/, "") : caminho;
  return ITENS_DE_MENU.find((item) => item.caminho === limpo);
}
