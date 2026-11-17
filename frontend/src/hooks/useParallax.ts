import { useEffect, useRef } from "react";
import { SEM_INCLINACAO, estabilizou, inclinacaoDoAparelho, inclinacaoDoPonteiro, suavizar, type Inclinacao } from "../util/parallax.ts";

export function useParallax(aoMover: (inclinacao: Inclinacao) => void): void {
  const funcao = useRef(aoMover);
  funcao.current = aoMover;

  useEffect(() => {
    const reduzir = window.matchMedia("(prefers-reduced-motion: reduce)");
    funcao.current(SEM_INCLINACAO);
    if (reduzir.matches) return;
    let alvo: Inclinacao = SEM_INCLINACAO;
    let atual: Inclinacao = SEM_INCLINACAO;
    let quadro = 0;

    const animar = () => {
      quadro = 0;
      atual = suavizar(atual, alvo);
      if (estabilizou(atual, alvo)) atual = alvo;
      funcao.current(atual);
      if (atual !== alvo) quadro = window.requestAnimationFrame(animar);
    };
    const pedir = () => {
      if (quadro === 0) quadro = window.requestAnimationFrame(animar);
    };

    const aoPonteiro = (evento: PointerEvent) => {
      alvo = inclinacaoDoPonteiro(evento.clientX, evento.clientY, window.innerWidth, window.innerHeight);
      pedir();
    };
    const aoAparelho = (evento: DeviceOrientationEvent) => {
      alvo = inclinacaoDoAparelho(evento.beta, evento.gamma);
      pedir();
    };
    const aoSair = () => {
      alvo = SEM_INCLINACAO;
      pedir();
    };

    window.addEventListener("pointermove", aoPonteiro, { passive: true });
    document.addEventListener("pointerleave", aoSair);
    window.addEventListener("deviceorientation", aoAparelho, { passive: true });
    return () => {
      window.removeEventListener("pointermove", aoPonteiro);
      document.removeEventListener("pointerleave", aoSair);
      window.removeEventListener("deviceorientation", aoAparelho);
      if (quadro !== 0) window.cancelAnimationFrame(quadro);
    };
  }, []);
}

type ComPermissao = { requestPermission?: () => Promise<string> };

export function precisaDePermissaoDeMovimento(): boolean {
  return window.matchMedia("(pointer: coarse)").matches && typeof DeviceOrientationEvent !== "undefined" && typeof (DeviceOrientationEvent as unknown as ComPermissao).requestPermission === "function";
}

export async function pedirPermissaoDeMovimento(): Promise<boolean> {
  const pedir = (DeviceOrientationEvent as unknown as ComPermissao).requestPermission;
  if (typeof pedir !== "function") return true;
  try {
    return (await pedir.call(DeviceOrientationEvent)) === "granted";
  } catch {
    return false;
  }
}
