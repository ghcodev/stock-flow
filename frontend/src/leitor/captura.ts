import { codigoDeEtiquetaValido } from "../util/formularios.ts";
import { criarDetector, type Detector, type Leitura } from "./detector.ts";

export type AlvoDeTecla = {
  tagName?: string | undefined;
  isContentEditable?: boolean | undefined;
};

export type EventoDeTecla = {
  key: string;
  timeStamp: number;
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
  isComposing?: boolean | undefined;
  repeat?: boolean | undefined;
  target: AlvoDeTecla | null;
  preventDefault: () => void;
};

export type Ouvinte = (leitura: Leitura) => void;

const CAMPOS_EDITAVEIS = new Set(["INPUT", "TEXTAREA", "SELECT"]);

export function ehCampoEditavel(alvo: AlvoDeTecla | null): boolean {
  if (alvo === null) return false;
  if (alvo.isContentEditable === true) return true;
  return alvo.tagName !== undefined && CAMPOS_EDITAVEIS.has(alvo.tagName.toUpperCase());
}

export function normalizarCodigoLido(codigo: string): string | null {
  const limpo = codigo.trim();
  return codigoDeEtiquetaValido(limpo) ? limpo : null;
}

export type Captura = {
  habilitar: (valor: boolean) => void;
  habilitada: () => boolean;
  processar: (evento: EventoDeTecla) => void;
  assinar: (ouvinte: Ouvinte) => () => void;
  emitir: (leitura: Leitura) => void;
  reiniciar: () => void;
};

type Dependencias = {
  detector?: Detector;
  agora?: () => number;
  agendar?: (tarefa: () => void, atrasoMs: number) => () => void;
  validadeDaPendenteMs?: number;
};

export function criarCaptura(dependencias: Dependencias = {}): Captura {
  const detector = dependencias.detector ?? criarDetector();
  const agora = dependencias.agora ?? (() => Date.now());
  const validade = dependencias.validadeDaPendenteMs ?? 3000;
  const agendar =
    dependencias.agendar ??
    ((tarefa: () => void, atrasoMs: number) => {
      const temporizador = setTimeout(tarefa, atrasoMs);
      return () => clearTimeout(temporizador);
    });
  let habilitada = false;
  let cancelarExpiracao: (() => void) | null = null;
  const ouvintes = new Set<Ouvinte>();
  let pendente: { leitura: Leitura; em: number } | null = null;

  const descartarPendente = () => {
    pendente = null;
    cancelarExpiracao?.();
    cancelarExpiracao = null;
  };

  const emitir = (leitura: Leitura) => {
    if (ouvintes.size === 0) {
      if (!habilitada) return;
      descartarPendente();
      const guardada = { leitura, em: agora() };
      pendente = guardada;
      cancelarExpiracao = agendar(() => {
        if (pendente === guardada) descartarPendente();
      }, validade);
      return;
    }
    for (const ouvinte of Array.from(ouvintes)) ouvinte(leitura);
  };

  return {
    habilitar(valor) {
      habilitada = valor;
      if (!valor) {
        detector.reiniciar();
        descartarPendente();
      }
    },
    habilitada: () => habilitada,
    processar(evento) {
      if (!habilitada) return;
      if (evento.repeat === true || evento.isComposing === true || evento.ctrlKey || evento.metaKey || evento.altKey) return;
      if (ehCampoEditavel(evento.target)) {
        detector.reiniciar();
        return;
      }
      const leitura = detector.tecla(evento.key, evento.timeStamp);
      if (leitura === null || leitura.origem !== "leitor") return;
      evento.preventDefault();
      emitir(leitura);
    },
    assinar(ouvinte) {
      ouvintes.add(ouvinte);
      if (pendente !== null) {
        const guardada = pendente;
        descartarPendente();
        if (agora() - guardada.em <= validade) ouvinte(guardada.leitura);
      }
      return () => {
        ouvintes.delete(ouvinte);
      };
    },
    emitir,
    reiniciar() {
      detector.reiniciar();
      descartarPendente();
    },
  };
}

let instancia: Captura | null = null;
let iniciada = false;

export function capturaGlobal(): Captura {
  instancia ??= criarCaptura();
  return instancia;
}

export function iniciarCaptura(alvo: Window = window, habilitada = false): void {
  if (iniciada) return;
  iniciada = true;
  const captura = capturaGlobal();
  captura.habilitar(habilitada);
  alvo.addEventListener(
    "keydown",
    (evento) => {
      captura.processar({
        key: evento.key,
        timeStamp: evento.timeStamp,
        ctrlKey: evento.ctrlKey,
        metaKey: evento.metaKey,
        altKey: evento.altKey,
        isComposing: evento.isComposing,
        repeat: evento.repeat,
        target: evento.target instanceof HTMLElement ? evento.target : null,
        preventDefault: () => evento.preventDefault(),
      });
    },
    { capture: true },
  );
}
