import type { Perfil, UsuarioPublico } from "../api/tipos.ts";

export type Armazenamento = {
  getItem: (chave: string) => string | null;
  setItem: (chave: string, valor: string) => void;
  removeItem: (chave: string) => void;
};

export type Sessao = {
  token: string;
  usuario: UsuarioPublico;
};

export const CHAVE_DA_SESSAO = "sf.sessao";

const PERFIS: readonly Perfil[] = ["administrador", "operador"];

function ehObjeto(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === "object" && valor !== null && !Array.isArray(valor);
}

function decodificarSegmento(segmento: string): unknown {
  const base64 = segmento.replace(/-/g, "+").replace(/_/g, "/");
  const preenchido = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
  const bytes = Uint8Array.from(atob(preenchido), (c) => c.charCodeAt(0));
  return JSON.parse(new TextDecoder().decode(bytes));
}

export function expiracaoDoToken(token: string): number | null {
  const partes = token.split(".");
  if (partes.length !== 3) return null;
  try {
    const carga = decodificarSegmento(partes[1] ?? "");
    const exp = ehObjeto(carga) ? carga["exp"] : undefined;
    return typeof exp === "number" && Number.isFinite(exp) ? exp * 1000 : null;
  } catch {
    return null;
  }
}

export function tokenVigente(token: string, agoraMs: number): boolean {
  const expiracao = expiracaoDoToken(token);
  return expiracao !== null && expiracao > agoraMs;
}

function lerUsuario(valor: unknown): UsuarioPublico | null {
  if (!ehObjeto(valor)) return null;
  const { id_usuario, nome, email, perfil } = valor;
  if (typeof id_usuario !== "number" || typeof nome !== "string" || typeof email !== "string") return null;
  if (typeof perfil !== "string" || !PERFIS.includes(perfil as Perfil)) return null;
  return { id_usuario, nome, email, perfil: perfil as Perfil };
}

export function limparSessao(armazenamento: Armazenamento): void {
  try {
    armazenamento.removeItem(CHAVE_DA_SESSAO);
  } catch {
    return;
  }
}

export function salvarSessao(armazenamento: Armazenamento, sessao: Sessao): void {
  try {
    armazenamento.setItem(CHAVE_DA_SESSAO, JSON.stringify(sessao));
  } catch {
    return;
  }
}

export function carregarSessao(armazenamento: Armazenamento, agoraMs: number): Sessao | null {
  let bruto: string | null;
  try {
    bruto = armazenamento.getItem(CHAVE_DA_SESSAO);
  } catch {
    return null;
  }
  if (bruto === null) return null;
  try {
    const dados: unknown = JSON.parse(bruto);
    if (ehObjeto(dados) && typeof dados["token"] === "string") {
      const usuario = lerUsuario(dados["usuario"]);
      if (usuario && tokenVigente(dados["token"], agoraMs)) return { token: dados["token"], usuario };
    }
  } catch {
    limparSessao(armazenamento);
    return null;
  }
  limparSessao(armazenamento);
  return null;
}
