import { useEffect, useRef } from "react";
import { SEM_INCLINACAO, estabilizou, inclinacaoDoAparelho, inclinacaoDoPonteiro, suavizar, type Inclinacao } from "../util/parallax.ts";

export function useParallax(aoMover: (inclinacao: Inclinacao) => void): void {
  const funcao = useRef(aoMover);
  funcao.current = aoMover;

  useEffect(() => {
    const reduzir = window.matchMedia("(prefers-reduced-motion: reduce)");
    let alvo: Inclinacao = SEM_INCLINACAO;
    let atual: Inclinacao = SEM_INCLINACAO;
    let quadro = 0;
    let ligado = false;

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

    const ligar = () => {
      if (ligado) return;
      ligado = true;
      window.addEventListener("pointermove", aoPonteiro, { passive: true });
      document.addEventListener("pointerleave", aoSair);
      window.addEventListener("deviceorientation", aoAparelho, { passive: true });
    };
    const desligar = () => {
      if (!ligado) return;
      ligado = false;
      window.removeEventListener("pointermove", aoPonteiro);
      document.removeEventListener("pointerleave", aoSair);
      window.removeEventListener("deviceorientation", aoAparelho);
      if (quadro !== 0) {
        window.cancelAnimationFrame(quadro);
        quadro = 0;
      }
      alvo = SEM_INCLINACAO;
      atual = SEM_INCLINACAO;
      funcao.current(SEM_INCLINACAO);
    };
    const aoMudarPreferencia = () => {
      if (reduzir.matches) desligar();
      else ligar();
    };

    funcao.current(SEM_INCLINACAO);
    if (!reduzir.matches) ligar();
    reduzir.addEventListener("change", aoMudarPreferencia);
    return () => {
      reduzir.removeEventListener("change", aoMudarPreferencia);
      desligar();
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
