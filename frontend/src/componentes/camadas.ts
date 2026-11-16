import { useEffect, useRef, type RefObject } from "react";

type Camada = { elemento: HTMLElement; aoFechar: () => void };

const pilha: Camada[] = [];
let escutando = false;

const SELETOR_FOCAVEL = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function focaveisDe(elemento: HTMLElement): HTMLElement[] {
  return Array.from(elemento.querySelectorAll<HTMLElement>(SELETOR_FOCAVEL)).filter((item) => !item.hasAttribute("inert"));
}

function aoTeclar(evento: KeyboardEvent): void {
  const topo = pilha[pilha.length - 1];
  if (!topo) return;
  if (evento.key === "Escape") {
    const alvo = evento.target instanceof Element ? evento.target : null;
    if (alvo?.closest('[role="combobox"][aria-expanded="true"]')) return;
    if (document.querySelector('[role="menu"]')) return;
    evento.stopPropagation();
    topo.aoFechar();
    return;
  }
  if (evento.key !== "Tab") return;
  const itens = focaveisDe(topo.elemento);
  const primeiro = itens[0];
  const ultimo = itens[itens.length - 1];
  if (!primeiro || !ultimo) {
    evento.preventDefault();
    topo.elemento.focus();
    return;
  }
  const ativo = document.activeElement;
  if (!topo.elemento.contains(ativo)) {
    evento.preventDefault();
    primeiro.focus();
  } else if (evento.shiftKey && ativo === primeiro) {
    evento.preventDefault();
    ultimo.focus();
  } else if (!evento.shiftKey && ativo === ultimo) {
    evento.preventDefault();
    primeiro.focus();
  }
}

function raizDaAplicacao(): HTMLElement | null {
  return document.getElementById("raiz");
}

function atualizarInercia(): void {
  const raiz = raizDaAplicacao();
  if (raiz) raiz.inert = pilha.length > 0;
  pilha.forEach((camada, indice) => {
    camada.elemento.inert = indice < pilha.length - 1;
  });
}

export function empilharCamada(camada: Camada): () => void {
  pilha.push(camada);
  if (!escutando) {
    document.addEventListener("keydown", aoTeclar, true);
    escutando = true;
  }
  atualizarInercia();
  return () => {
    const indice = pilha.indexOf(camada);
    if (indice >= 0) pilha.splice(indice, 1);
    camada.elemento.inert = false;
    atualizarInercia();
    if (pilha.length === 0 && escutando) {
      document.removeEventListener("keydown", aoTeclar, true);
      escutando = false;
    }
  };
}

export function profundidadeDeCamadas(): number {
  return pilha.length;
}

export function useCamada(aberto: boolean, aoFechar: () => void, elemento: RefObject<HTMLElement | null>): void {
  const fechar = useRef(aoFechar);
  fechar.current = aoFechar;

  useEffect(() => {
    const alvo = elemento.current;
    if (!aberto || !alvo) return;
    const anterior = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const desempilhar = empilharCamada({ elemento: alvo, aoFechar: () => fechar.current() });
    const inicial = alvo.querySelector<HTMLElement>("[data-foco-inicial]") ?? focaveisDe(alvo)[0] ?? alvo;
    inicial.focus();
    return () => {
      desempilhar();
      if (anterior && document.contains(anterior)) anterior.focus();
    };
  }, [aberto, elemento]);
}
