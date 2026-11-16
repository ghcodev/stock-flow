import { useCallback, useEffect, useRef, useState, type DependencyList } from "react";
import { ErroDeRede, mensagemDoErro } from "../api/erros.ts";

export type EstadoDeCarga<T> = {
  dados: T | null;
  carregando: boolean;
  erro: string | null;
  recarregar: () => void;
};

export function useCarregar<T>(carregar: (sinal: AbortSignal) => Promise<T>, dependencias: DependencyList, ativo = true): EstadoDeCarga<T> {
  const [dados, setDados] = useState<T | null>(null);
  const [carregando, setCarregando] = useState(ativo);
  const [erro, setErro] = useState<string | null>(null);
  const [versao, setVersao] = useState(0);
  const funcao = useRef(carregar);
  funcao.current = carregar;

  useEffect(() => {
    if (!ativo) return;
    const controle = new AbortController();
    setCarregando(true);
    funcao.current(controle.signal).then(
      (resultado) => {
        if (controle.signal.aborted) return;
        setDados(resultado);
        setErro(null);
        setCarregando(false);
      },
      (falha: unknown) => {
        if (controle.signal.aborted) return;
        if (falha instanceof ErroDeRede && falha.motivo === "CANCELADO") return;
        setErro(mensagemDoErro(falha));
        setCarregando(false);
      },
    );
    return () => controle.abort();
  }, [...dependencias, versao, ativo]);

  const recarregar = useCallback(() => setVersao((atual) => atual + 1), []);

  return { dados, carregando, erro, recarregar };
}
