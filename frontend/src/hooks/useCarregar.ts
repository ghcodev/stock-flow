import { useCallback, useEffect, useRef, useState, type DependencyList } from "react";
import { ErroDeRede, mensagemDoErro } from "../api/erros.ts";
import { aplicarFalha, aplicarSucesso, estadoInicial, mesmasDependencias, visivel, type EstadoDaCarga } from "../util/carga.ts";

export type EstadoDeCarga<T> = {
  dados: T | null;
  carregando: boolean;
  erro: string | null;
  recarregar: () => void;
};

export function useCarregar<T>(carregar: (sinal: AbortSignal) => Promise<T>, dependencias: DependencyList, ativo = true): EstadoDeCarga<T> {
  const [estado, setEstado] = useState<EstadoDaCarga<T>>(estadoInicial);
  const [carregando, setCarregando] = useState(ativo);
  const [versao, setVersao] = useState(0);
  const funcao = useRef(carregar);
  funcao.current = carregar;
  const consulta = useRef(0);
  const anteriores = useRef<readonly unknown[] | null>(null);
  if (!mesmasDependencias(anteriores.current, dependencias)) {
    consulta.current += 1;
    anteriores.current = [...dependencias];
  }
  const consultaAtual = consulta.current;

  useEffect(() => {
    if (!ativo) return;
    const controle = new AbortController();
    setCarregando(true);
    funcao.current(controle.signal).then(
      (resultado) => {
        if (controle.signal.aborted) return;
        setEstado((atual) => aplicarSucesso(atual, consultaAtual, resultado));
        setCarregando(false);
      },
      (falha: unknown) => {
        if (controle.signal.aborted) return;
        if (falha instanceof ErroDeRede && falha.motivo === "CANCELADO") return;
        setEstado((atual) => aplicarFalha(atual, consultaAtual, mensagemDoErro(falha)));
        setCarregando(false);
      },
    );
    return () => controle.abort();
  }, [consultaAtual, versao, ativo]);

  const recarregar = useCallback(() => setVersao((atual) => atual + 1), []);
  const { dados, erro } = visivel(estado, consultaAtual);

  return { dados, carregando, erro, recarregar };
}
