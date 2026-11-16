import { ErroDaApi, ErroDeRede } from "./erros.ts";
import type { CampoInvalido, Consulta } from "./tipos.ts";

export type Metodo = "GET" | "POST" | "PATCH" | "PUT" | "DELETE";

export type OpcoesDeRequisicao = {
  consulta?: Consulta | undefined;
  corpo?: unknown;
  sinal?: AbortSignal | undefined;
  tempoLimiteMs?: number | undefined;
};

export type ArquivoBaixado = {
  blob: Blob;
  nomeDoArquivo: string | null;
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
  baixar: (caminho: string, opcoes?: OpcoesDeRequisicao) => Promise<ArquivoBaixado>;
};

const BASE_PADRAO = "/api";
const TEMPO_LIMITE_PADRAO_MS = 15_000;

export function nomeDoArquivoDoCabecalho(cabecalho: string | null): string | null {
  if (cabecalho === null) return null;
  const estendido = /filename\*\s*=\s*UTF-8''([^;]+)/i.exec(cabecalho);
  let bruto: string | null = null;
  if (estendido?.[1] !== undefined) {
    try {
      bruto = decodeURIComponent(estendido[1].trim());
    } catch {
      bruto = null;
    }
  }
  if (bruto === null) {
    const simples = /filename\s*=\s*(?:"([^"]*)"|([^;]+))/i.exec(cabecalho);
    bruto = (simples?.[1] ?? simples?.[2] ?? "").trim();
  }
  const limpo = bruto.replace(/[\u0000-\u001f\u007f]/g, "").split(/[\\/]/).pop() ?? "";
  const seguro = limpo.replace(/[^A-Za-z0-9._-]/g, "_").replace(/^\.+/, "").slice(0, 100);
  return seguro === "" ? null : seguro;
}

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

const CONTROLE_OU_BARRA_INVERTIDA = /[\u0000-\u001f\u007f\\]/;

const ETAPAS_DE_DECODIFICACAO = 8;

function etapaValida(texto: string): boolean {
  if (texto.includes("//") || CONTROLE_OU_BARRA_INVERTIDA.test(texto)) return false;
  return !texto.split("/").some((parte) => parte === ".." || parte === ".");
}

export function caminhoDeApiValido(caminho: string): boolean {
  if (!caminho.startsWith("/") || /[?#]/.test(caminho)) return false;
  let atual = caminho;
  for (let etapa = 0; etapa <= ETAPAS_DE_DECODIFICACAO; etapa++) {
    if (!etapaValida(atual)) return false;
    let decodificado: string;
    try {
      decodificado = decodeURIComponent(atual);
    } catch {
      return false;
    }
    if (decodificado === atual) return true;
    atual = decodificado;
  }
  return false;
}

export function segmento(valor: string | number): string {
  return encodeURIComponent(String(valor));
}

export function montarUrl(base: string, caminho: string, consulta: Consulta | undefined): string {
  if (!caminhoDeApiValido(caminho)) throw new Error("Caminho de API inválido");
  return `${base}${caminho}${montarConsulta(consulta)}`;
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

async function lerCorpoJson(resposta: Response, aoAbortar: () => ErroDeRede, sinal: AbortSignal): Promise<unknown> {
  try {
    return await resposta.json();
  } catch (erro) {
    if (sinal.aborted) throw aoAbortar();
    if (erro instanceof SyntaxError) return undefined;
    throw new ErroDeRede("SEM_CONEXAO", "Conexão interrompida durante a resposta");
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

  async function executar<T>(
    metodo: Metodo,
    caminho: string,
    opcoes: OpcoesDeRequisicao,
    aceite: string,
    lerSucesso: (resposta: Response, aoAbortar: () => ErroDeRede, sinal: AbortSignal) => Promise<T>,
  ): Promise<T> {
    const url = montarUrl(base, caminho, opcoes.consulta);
    const token = dependencias.obterToken();
    const cabecalhos: Record<string, string> = { Accept: aceite };
    if (token !== null) cabecalhos["Authorization"] = `Bearer ${token}`;
    const temCorpo = opcoes.corpo !== undefined;
    if (temCorpo) cabecalhos["Content-Type"] = "application/json";

    const controle = new AbortController();
    let esgotou = false;
    const temporizador = setTimeout(() => {
      esgotou = true;
      controle.abort();
    }, opcoes.tempoLimiteMs ?? tempoLimite);
    const cancelarPeloChamador = () => controle.abort();
    if (opcoes.sinal) {
      if (opcoes.sinal.aborted) controle.abort();
      else opcoes.sinal.addEventListener("abort", cancelarPeloChamador, { once: true });
    }
    const aoAbortar = (): ErroDeRede =>
      esgotou ? new ErroDeRede("TEMPO_ESGOTADO", "Tempo limite esgotado") : new ErroDeRede("CANCELADO", "Requisição cancelada");

    try {
      let resposta: Response;
      try {
        resposta = await dependencias.buscar(url, {
          method: metodo,
          headers: cabecalhos,
          body: temCorpo ? JSON.stringify(opcoes.corpo) : null,
          signal: controle.signal,
          credentials: "same-origin",
        });
      } catch {
        throw controle.signal.aborted ? aoAbortar() : new ErroDeRede("SEM_CONEXAO", "Sem conexão com o servidor");
      }

      if (resposta.ok) return await lerSucesso(resposta, aoAbortar, controle.signal);

      const segundos = lerSegundosParaRepetir(resposta.headers.get("Retry-After"), agora());
      const erro = erroDaResposta(resposta, await lerCorpoJson(resposta, aoAbortar, controle.signal), segundos);
      if (resposta.status === 401 && token !== null && dependencias.obterToken() === token) dependencias.aoNaoAutorizado();
      throw erro;
    } finally {
      clearTimeout(temporizador);
      opcoes.sinal?.removeEventListener("abort", cancelarPeloChamador);
    }
  }

  async function requisitar<T>(metodo: Metodo, caminho: string, opcoes: OpcoesDeRequisicao = {}): Promise<T> {
    return executar<T>(metodo, caminho, opcoes, "application/json", async (resposta, aoAbortar, sinal) => {
      if (resposta.status === 204) return undefined as T;
      const corpo = await lerCorpoJson(resposta, aoAbortar, sinal);
      if (corpo === undefined) throw new ErroDaApi(resposta.status, "RESPOSTA_INVALIDA", "Resposta inesperada do servidor");
      return corpo as T;
    });
  }

  async function baixar(caminho: string, opcoes: OpcoesDeRequisicao = {}): Promise<ArquivoBaixado> {
    return executar<ArquivoBaixado>("GET", caminho, opcoes, "text/csv, application/octet-stream, */*;q=0.1", async (resposta, aoAbortar, sinal) => {
      try {
        const blob = await resposta.blob();
        return { blob, nomeDoArquivo: nomeDoArquivoDoCabecalho(resposta.headers.get("Content-Disposition")) };
      } catch {
        if (sinal.aborted) throw aoAbortar();
        throw new ErroDeRede("SEM_CONEXAO", "Conexão interrompida durante o download");
      }
    });
  }

  return {
    requisitar,
    get: (caminho, consulta, sinal) => requisitar("GET", caminho, { consulta, sinal }),
    post: (caminho, corpo, sinal) => requisitar("POST", caminho, { corpo, sinal }),
    patch: (caminho, corpo, sinal) => requisitar("PATCH", caminho, { corpo, sinal }),
    baixar,
  };
}
