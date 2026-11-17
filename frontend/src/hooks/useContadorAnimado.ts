import { useEffect, useRef, useState } from "react";
import { valorDoContador } from "../util/animacao.ts";

const DURACAO_MS = 900;

export function useContadorAnimado(valor: number | null): number | null {
  const [exibido, setExibido] = useState<number | null>(null);
  const [reduzir, setReduzir] = useState(() => window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  const atual = useRef<number>(0);

  useEffect(() => {
    const consulta = window.matchMedia("(prefers-reduced-motion: reduce)");
    const aoMudar = () => setReduzir(consulta.matches);
    consulta.addEventListener("change", aoMudar);
    return () => consulta.removeEventListener("change", aoMudar);
  }, []);

  useEffect(() => {
    if (valor === null) {
      setExibido(null);
      return;
    }
    if (reduzir || valor === atual.current) {
      atual.current = valor;
      setExibido(valor);
      return;
    }
    const de = atual.current;
    const inicio = performance.now();
    let quadro = 0;
    const passo = (agora: number) => {
      const progresso = (agora - inicio) / DURACAO_MS;
      const proximo = valorDoContador(de, valor, progresso);
      atual.current = proximo;
      setExibido(proximo);
      if (progresso < 1) quadro = window.requestAnimationFrame(passo);
      else {
        atual.current = valor;
        setExibido(valor);
      }
    };
    quadro = window.requestAnimationFrame(passo);
    return () => window.cancelAnimationFrame(quadro);
  }, [valor, reduzir]);

  return exibido;
}
