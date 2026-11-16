import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { capturaGlobal, ehCampoEditavel } from "./captura.ts";
import type { Leitura } from "./detector.ts";
import { gerenciadorSerial, type EstadoDoGerenciador } from "./gerenciador.ts";

export type EstadoDoSerial = EstadoDoGerenciador & {
  conectar: () => void;
  desconectar: () => void;
};

export type EstadoDoLeitor = {
  pronto: boolean;
  focoEmCampo: boolean;
  serial: EstadoDoSerial;
};

function campoEmFoco(): boolean {
  return ehCampoEditavel(document.activeElement instanceof HTMLElement ? document.activeElement : null);
}

export function useLeitor(aoLeitura: (leitura: Leitura) => void): EstadoDoLeitor {
  const [focoEmCampo, setFocoEmCampo] = useState(campoEmFoco);
  const funcao = useRef(aoLeitura);
  funcao.current = aoLeitura;
  const gerenciador = gerenciadorSerial();
  const estado = useSyncExternalStore(gerenciador.assinar, gerenciador.estado);

  useEffect(() => {
    const captura = capturaGlobal();
    captura.habilitar(true);
    const cancelar = captura.assinar((leitura) => funcao.current(leitura));
    return () => {
      cancelar();
      captura.habilitar(false);
    };
  }, []);

  useEffect(() => {
    const atualizar = () => setFocoEmCampo(campoEmFoco());
    document.addEventListener("focusin", atualizar);
    document.addEventListener("focusout", atualizar);
    return () => {
      document.removeEventListener("focusin", atualizar);
      document.removeEventListener("focusout", atualizar);
    };
  }, []);

  const conectar = useCallback(() => gerenciador.conectar(), [gerenciador]);
  const desconectar = useCallback(() => gerenciador.desconectar(), [gerenciador]);

  return { pronto: !focoEmCampo, focoEmCampo, serial: { ...estado, conectar, desconectar } };
}
