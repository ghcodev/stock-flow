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
  processar: (evento: EventoDeTecla) => void;
  assinar: (ouvinte: Ouvinte) => () => void;
  emitir: (leitura: Leitura) => void;
  reiniciar: () => void;
};

type Dependencias = {
  detector?: Detector;
  agora?: () => number;
  validadeDaPendenteMs?: number;
};

export function criarCaptura(dependencias: Dependencias = {}): Captura {
  const detector = dependencias.detector ?? criarDetector();
  const agora = dependencias.agora ?? (() => Date.now());
  const validade = dependencias.validadeDaPendenteMs ?? 3000;
  const ouvintes = new Set<Ouvinte>();
  let pendente: { leitura: Leitura; em: number } | null = null;

  const emitir = (leitura: Leitura) => {
    if (ouvintes.size === 0) {
      pendente = { leitura, em: agora() };
      return;
    }
    for (const ouvinte of Array.from(ouvintes)) ouvinte(leitura);
  };

  return {
    processar(evento) {
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
        pendente = null;
        if (agora() - guardada.em <= validade) ouvinte(guardada.leitura);
      }
      return () => {
        ouvintes.delete(ouvinte);
      };
    },
    emitir,
    reiniciar() {
      detector.reiniciar();
      pendente = null;
    },
  };
}

let instancia: Captura | null = null;
let iniciada = false;

export function capturaGlobal(): Captura {
  instancia ??= criarCaptura();
  return instancia;
}

export function iniciarCaptura(alvo: Window = window): void {
  if (iniciada) return;
  iniciada = true;
  const captura = capturaGlobal();
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
