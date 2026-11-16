import { ErroDaApi, ErroDeRede } from "./erros.ts";
import type { CampoInvalido, Consulta } from "./tipos.ts";

export type Metodo = "GET" | "POST" | "PATCH" | "PUT" | "DELETE";

export type OpcoesDeRequisicao = {
  consulta?: Consulta;
  corpo?: unknown;
  sinal?: AbortSignal;
};

export type DependenciasDoCliente = {
  buscar: typeof fetch;
  obterToken: () => string | null;
  aoNaoAutorizado: () => void;
  agora?: () => number;
  baseUrl?: string;
  tempoLimiteMs?: number;
};

export type Cliente = {
  requisitar: <T>(metodo: Metodo, caminho: string, opcoes?: OpcoesDeRequisicao) => Promise<T>;
  get: <T>(caminho: string, consulta?: Consulta, sinal?: AbortSignal) => Promise<T>;
  post: <T>(caminho: string, corpo?: unknown, sinal?: AbortSignal) => Promise<T>;
  patch: <T>(caminho: string, corpo?: unknown, sinal?: AbortSignal) => Promise<T>;
};

const BASE_PADRAO = "/api";
const TEMPO_LIMITE_PADRAO_MS = 15_000;

export function montarConsulta(consulta: Consulta | undefined): string {
  if (!consulta) return "";
  const parametros = new URLSearchParams();
  for (const [chave, valor] of Object.entries(consulta)) {
    if (valor === undefined || valor === null || valor === "") continue;
    parametros.set(chave, String(valor));
  }
  const texto = parametros.toString();
  return texto === "" ? "" : `?${texto}`;
}

export function lerSegundosParaRepetir(valor: string | null, agoraMs: number): number | null {
  if (valor === null) return null;
  const texto = valor.trim();
  if (/^\d{1,9}$/.test(texto)) return Number(texto);
  const instante = Date.parse(texto);
  if (Number.isNaN(instante)) return null;
  return Math.max(0, Math.ceil((instante - agoraMs) / 1000));
}

function ehObjeto(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === "object" && valor !== null && !Array.isArray(valor);
}

function lerCampos(valor: unknown): CampoInvalido[] {
  if (!Array.isArray(valor)) return [];
  const campos: CampoInvalido[] = [];
  for (const item of valor) {
    if (ehObjeto(item) && typeof item["campo"] === "string" && typeof item["mensagem"] === "string") {
      campos.push({ campo: item["campo"], mensagem: item["mensagem"] });
    }
  }
  return campos;
}

async function lerCorpoJson(resposta: Response): Promise<unknown> {
  try {
    return await resposta.json();
  } catch {
    return undefined;
  }
}

function erroDaResposta(resposta: Response, corpo: unknown, segundos: number | null): ErroDaApi {
  if (ehObjeto(corpo) && ehObjeto(corpo["erro"])) {
    const { codigo, mensagem, campos } = corpo["erro"];
    if (typeof codigo === "string" && typeof mensagem === "string") {
      return new ErroDaApi(resposta.status, codigo, mensagem, lerCampos(campos), segundos);
    }
  }
  return new ErroDaApi(
    resposta.status,
    resposta.status >= 500 ? "ERRO_DO_SERVIDOR" : "ERRO_DESCONHECIDO",
    "Resposta inesperada do servidor",
    [],
    segundos,
  );
}

export function criarCliente(dependencias: DependenciasDoCliente): Cliente {
  const base = dependencias.baseUrl ?? BASE_PADRAO;
  const tempoLimite = dependencias.tempoLimiteMs ?? TEMPO_LIMITE_PADRAO_MS;
  const agora = dependencias.agora ?? Date.now;

  async function requisitar<T>(metodo: Metodo, caminho: string, opcoes: OpcoesDeRequisicao = {}): Promise<T> {
    const token = dependencias.obterToken();
    const cabecalhos: Record<string, string> = { Accept: "application/json" };
    if (token !== null) cabecalhos["Authorization"] = `Bearer ${token}`;
    const temCorpo = opcoes.corpo !== undefined;
    if (temCorpo) cabecalhos["Content-Type"] = "application/json";

    const controle = new AbortController();
    let esgotou = false;
    const temporizador = setTimeout(() => {
      esgotou = true;
      controle.abort();
    }, tempoLimite);
    const cancelarPeloChamador = () => controle.abort();
    if (opcoes.sinal) {
      if (opcoes.sinal.aborted) controle.abort();
      else opcoes.sinal.addEventListener("abort", cancelarPeloChamador, { once: true });
    }

    let resposta: Response;
    try {
      resposta = await dependencias.buscar(`${base}${caminho}${montarConsulta(opcoes.consulta)}`, {
        method: metodo,
        headers: cabecalhos,
        body: temCorpo ? JSON.stringify(opcoes.corpo) : null,
        signal: controle.signal,
        credentials: "same-origin",
      });
    } catch {
      if (esgotou) throw new ErroDeRede("TEMPO_ESGOTADO", "Tempo limite esgotado");
      if (controle.signal.aborted) throw new ErroDeRede("CANCELADO", "Requisição cancelada");
      throw new ErroDeRede("SEM_CONEXAO", "Sem conexão com o servidor");
    } finally {
      clearTimeout(temporizador);
      opcoes.sinal?.removeEventListener("abort", cancelarPeloChamador);
    }

    if (resposta.ok) {
      if (resposta.status === 204) return undefined as T;
      const corpo = await lerCorpoJson(resposta);
      if (corpo === undefined) throw new ErroDaApi(resposta.status, "RESPOSTA_INVALIDA", "Resposta inesperada do servidor");
      return corpo as T;
    }

    const segundos = lerSegundosParaRepetir(resposta.headers.get("Retry-After"), agora());
    const erro = erroDaResposta(resposta, await lerCorpoJson(resposta), segundos);
    if (resposta.status === 401 && token !== null) dependencias.aoNaoAutorizado();
    throw erro;
  }

  return {
    requisitar,
    get: (caminho, consulta, sinal) => requisitar("GET", caminho, { consulta, sinal }),
    post: (caminho, corpo, sinal) => requisitar("POST", caminho, { corpo, sinal }),
    patch: (caminho, corpo, sinal) => requisitar("PATCH", caminho, { corpo, sinal }),
  };
}
