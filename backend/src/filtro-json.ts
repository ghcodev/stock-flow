const MAX_CARACTERES = 512;
const MAX_PROFUNDIDADE = 3;
const MAX_CHAVES = 20;
const MAX_TAMANHO_CHAVE = 50;
const MAX_TEXTO = 100;
const MAX_ITENS_DE_LISTA = 10;
const CHAVES_PROIBIDAS = new Set(["senha_hash", "__proto__", "constructor", "prototype"]);

export type ValorJson = string | number | boolean | null | ValorJson[] | { [chave: string]: ValorJson };

function valido(valor: unknown, profundidade: number, contador: { chaves: number }): valor is ValorJson {
  if (valor === null || typeof valor === "boolean") return true;
  if (typeof valor === "number") return Number.isFinite(valor);
  if (typeof valor === "string") return valor.length <= MAX_TEXTO && !valor.includes("\u0000");
  if (Array.isArray(valor)) {
    return valor.length <= MAX_ITENS_DE_LISTA && valor.every((item) => valido(item, profundidade, contador));
  }
  if (typeof valor !== "object" || profundidade > MAX_PROFUNDIDADE) return false;
  for (const [chave, interno] of Object.entries(valor)) {
    contador.chaves += 1;
    if (contador.chaves > MAX_CHAVES || chave.length === 0 || chave.length > MAX_TAMANHO_CHAVE) return false;
    if (CHAVES_PROIBIDAS.has(chave) || chave.includes("\u0000")) return false;
    if (!valido(interno, profundidade + 1, contador)) return false;
  }
  return true;
}

export function lerFiltroJson(texto: string): { [chave: string]: ValorJson } | null {
  if (texto.length === 0 || texto.length > MAX_CARACTERES) return null;
  let bruto: unknown;
  try {
    bruto = JSON.parse(texto);
  } catch {
    return null;
  }
  if (typeof bruto !== "object" || bruto === null || Array.isArray(bruto)) return null;
  if (Object.keys(bruto).length === 0) return null;
  return valido(bruto, 1, { chaves: 0 }) ? (bruto as { [chave: string]: ValorJson }) : null;
}
