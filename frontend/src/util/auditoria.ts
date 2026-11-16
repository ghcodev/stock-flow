import type { Consulta } from "../api/tipos.ts";
import { ehDiaValido } from "./datas.ts";
import { contemNul, idValido } from "./formularios.ts";

const MAX_CARACTERES = 512;
const MAX_PROFUNDIDADE = 3;
const MAX_CHAVES = 20;
const MAX_TAMANHO_CHAVE = 50;
const MAX_TEXTO = 100;
const MAX_ITENS_DE_LISTA = 10;
const CHAVES_PROIBIDAS = new Set(["senha_hash", "__proto__", "constructor", "prototype"]);

type Contador = { chaves: number };

function valorValido(valor: unknown, profundidade: number, contador: Contador): boolean {
  if (valor === null || typeof valor === "boolean") return true;
  if (typeof valor === "number") return Number.isFinite(valor);
  if (typeof valor === "string") return valor.length <= MAX_TEXTO && !contemNul(valor);
  if (profundidade > MAX_PROFUNDIDADE) return false;
  if (Array.isArray(valor)) return valor.length <= MAX_ITENS_DE_LISTA && valor.every((item) => valorValido(item, profundidade + 1, contador));
  if (typeof valor !== "object") return false;
  for (const [chave, interno] of Object.entries(valor)) {
    contador.chaves += 1;
    if (contador.chaves > MAX_CHAVES || chave.length === 0 || chave.length > MAX_TAMANHO_CHAVE) return false;
    if (CHAVES_PROIBIDAS.has(chave) || contemNul(chave)) return false;
    if (!valorValido(interno, profundidade + 1, contador)) return false;
  }
  return true;
}

export const MENSAGEM_DO_FILTRO_JSON = "Use um objeto JSON simples (até 512 caracteres, 3 níveis e 20 chaves, sem senha_hash).";

export function validarFiltroJson(texto: string): string | null {
  const limpo = texto.trim();
  if (limpo === "") return null;
  if (limpo.length > MAX_CARACTERES) return MENSAGEM_DO_FILTRO_JSON;
  let bruto: unknown;
  try {
    bruto = JSON.parse(limpo);
  } catch {
    return "O conteúdo não é um JSON válido. Exemplo: {\"status_lote\":\"bloqueado\"}.";
  }
  if (typeof bruto !== "object" || bruto === null || Array.isArray(bruto) || Object.keys(bruto).length === 0) return MENSAGEM_DO_FILTRO_JSON;
  return valorValido(bruto, 1, { chaves: 0 }) ? null : MENSAGEM_DO_FILTRO_JSON;
}

const IPV4 = /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/;

export function ipValido(texto: string): boolean {
  const limpo = texto.trim();
  if (limpo === "" || limpo.length > 45 || contemNul(limpo)) return false;
  if (IPV4.test(limpo)) return true;
  if (!/^[0-9a-fA-F:.]+$/.test(limpo) || !limpo.includes(":")) return false;
  try {
    return new URL(`http://[${limpo}]/`).hostname !== "";
  } catch {
    return false;
  }
}

export function validarPeriodo(de: string, ate: string): { de?: string; ate?: string } {
  const erros: { de?: string; ate?: string } = {};
  if (de !== "" && !ehDiaValido(de)) erros.de = "Informe uma data válida.";
  if (ate !== "" && !ehDiaValido(ate)) erros.ate = "Informe uma data válida.";
  if (erros.de === undefined && erros.ate === undefined && de !== "" && ate !== "" && de > ate) erros.ate = "O fim deve ser igual ou posterior ao início.";
  return erros;
}

export type FiltrosDeAuditoria = {
  idUsuario: string;
  tabela: string;
  operacao: string;
  ip: string;
  de: string;
  ate: string;
  valorNovo: string;
  valorAnterior: string;
};

export const FILTROS_DE_AUDITORIA_VAZIOS: FiltrosDeAuditoria = { idUsuario: "", tabela: "", operacao: "", ip: "", de: "", ate: "", valorNovo: "", valorAnterior: "" };

export type ErrosDeAuditoria = Partial<Record<keyof FiltrosDeAuditoria, string>>;

export function validarFiltrosDeAuditoria(filtros: FiltrosDeAuditoria): ErrosDeAuditoria {
  const erros: ErrosDeAuditoria = {};
  if (filtros.idUsuario !== "" && !idValido(filtros.idUsuario)) erros.idUsuario = "Usuário inválido.";
  if (filtros.ip.trim() !== "" && !ipValido(filtros.ip)) erros.ip = "Informe um IPv4 ou IPv6 válido.";
  const periodo = validarPeriodo(filtros.de, filtros.ate);
  if (periodo.de) erros.de = periodo.de;
  if (periodo.ate) erros.ate = periodo.ate;
  const novo = validarFiltroJson(filtros.valorNovo);
  if (novo) erros.valorNovo = novo;
  const anterior = validarFiltroJson(filtros.valorAnterior);
  if (anterior) erros.valorAnterior = anterior;
  return erros;
}

export function consultaDeAuditoria(filtros: FiltrosDeAuditoria): Consulta {
  return {
    id_usuario: filtros.idUsuario === "" ? undefined : Number(filtros.idUsuario),
    tabela: filtros.tabela,
    operacao: filtros.operacao,
    ip: filtros.ip.trim(),
    de: filtros.de,
    ate: filtros.ate,
    valor_novo: filtros.valorNovo.trim(),
    valor_anterior: filtros.valorAnterior.trim(),
  };
}

export function chaveDosFiltros(consulta: Consulta): string {
  return JSON.stringify(Object.entries(consulta).filter(([, valor]) => valor !== undefined && valor !== null && valor !== "").sort(([a], [b]) => a.localeCompare(b)));
}

export function chavesAlteradas(anterior: unknown, novo: unknown): string[] {
  const comoObjeto = (valor: unknown): Record<string, unknown> => (typeof valor === "object" && valor !== null && !Array.isArray(valor) ? (valor as Record<string, unknown>) : {});
  const a = comoObjeto(anterior);
  const n = comoObjeto(novo);
  const chaves = new Set([...Object.keys(a), ...Object.keys(n)]);
  return Array.from(chaves)
    .filter((chave) => JSON.stringify(a[chave]) !== JSON.stringify(n[chave]))
    .sort();
}

export function textoDoJson(valor: unknown): string {
  return valor === null || valor === undefined ? "—" : JSON.stringify(valor, null, 2);
}
