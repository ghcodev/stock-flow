import { normalizarCodigoLido } from "./captura.ts";
import type { Leitura } from "./detector.ts";

export type PortaSerial = {
  open: (opcoes: { baudRate: number }) => Promise<void>;
  close: () => Promise<void>;
  readable: ReadableStream<Uint8Array> | null;
};

export type ApiSerial = {
  requestPort: () => Promise<PortaSerial>;
};

export type AmbienteSerial = {
  isSecureContext: boolean;
  navigator: { serial?: unknown };
};

export function serialDisponivel(ambiente: AmbienteSerial): boolean {
  const api = ambiente.navigator.serial;
  return ambiente.isSecureContext && typeof api === "object" && api !== null && "requestPort" in api;
}

export const TAMANHO_MAXIMO_DO_BUFFER = 512;

export type Montador = {
  alimentar: (pedaco: string) => string[];
  descartar: () => void;
};

export function criarMontadorDeCodigos(tamanhoMaximo: number = TAMANHO_MAXIMO_DO_BUFFER): Montador {
  let resto = "";
  let estourou = false;

  return {
    alimentar(pedaco) {
      const codigos: string[] = [];
      for (const caractere of pedaco) {
        if (caractere === "\r" || caractere === "\n") {
          if (!estourou) {
            const codigo = normalizarCodigoLido(resto);
            if (codigo !== null) codigos.push(codigo);
          }
          resto = "";
          estourou = false;
        } else if (!estourou) {
          resto += caractere;
          if (resto.length > tamanhoMaximo) {
            resto = "";
            estourou = true;
          }
        }
      }
      return codigos;
    },
    descartar() {
      resto = "";
      estourou = false;
    },
  };
}

export type ConexaoSerial = {
  encerrar: () => Promise<void>;
};

export type OpcoesDeConexao = {
  baudRate?: number;
  aoLer: (leitura: Leitura) => void;
  aoEncerrar: (erro: unknown) => void;
  cancelado?: () => boolean;
};

function obterApi(ambiente: AmbienteSerial): ApiSerial | null {
  return serialDisponivel(ambiente) ? (ambiente.navigator.serial as ApiSerial) : null;
}

export async function conectarSerial(ambiente: AmbienteSerial, opcoes: OpcoesDeConexao): Promise<ConexaoSerial> {
  const api = obterApi(ambiente);
  if (api === null) throw new Error("Web Serial indisponível neste navegador ou sem HTTPS");
  const cancelado = opcoes.cancelado ?? (() => false);
  const porta = await api.requestPort();
  if (cancelado()) throw new DOMException("Conexão cancelada", "AbortError");
  await porta.open({ baudRate: opcoes.baudRate ?? 9600 });
  if (cancelado()) {
    await porta.close().catch(() => undefined);
    throw new DOMException("Conexão cancelada", "AbortError");
  }
  const fluxo = porta.readable;
  if (fluxo === null) {
    await porta.close();
    throw new Error("Porta serial sem fluxo de leitura");
  }
  const leitor = fluxo.getReader();
  const decodificador = new TextDecoder("utf-8", { fatal: false });
  const montador = criarMontadorDeCodigos();
  let encerrando = false;

  const laco = (async () => {
    try {
      for (;;) {
        const { value, done } = await leitor.read();
        if (done) break;
        if (value === undefined) continue;
        for (const codigo of montador.alimentar(decodificador.decode(value, { stream: true }))) {
          if (cancelado()) break;
          opcoes.aoLer({ codigo, origem: "serial", intervaloMedioMs: null });
        }
      }
      if (!encerrando) opcoes.aoEncerrar(null);
    } catch (erro) {
      if (!encerrando) opcoes.aoEncerrar(erro);
    } finally {
      leitor.releaseLock();
      await porta.close().catch(() => undefined);
    }
  })();

  return {
    async encerrar() {
      encerrando = true;
      await leitor.cancel().catch(() => undefined);
      await laco;
    },
  };
}
