import { useCallback, useEffect, useRef, useState } from "react";
import { mensagemDoErro } from "../api/erros.ts";
import { capturaGlobal, ehCampoEditavel } from "./captura.ts";
import type { Leitura } from "./detector.ts";
import { conectarSerial, serialDisponivel, type ConexaoSerial } from "./serial.ts";

export type EstadoDoSerial = {
  disponivel: boolean;
  conectado: boolean;
  conectando: boolean;
  erro: string | null;
  conectar: () => void;
  desconectar: () => void;
};

export type EstadoDoLeitor = {
  pronto: boolean;
  focoEmCampo: boolean;
  serial: EstadoDoSerial;
};

function ambienteAtual() {
  return { isSecureContext: window.isSecureContext, navigator: window.navigator as { serial?: unknown } };
}

export function useLeitor(aoLeitura: (leitura: Leitura) => void): EstadoDoLeitor {
  const [focoEmCampo, setFocoEmCampo] = useState(() => ehCampoEditavel(document.activeElement as HTMLElement | null));
  const [conectado, setConectado] = useState(false);
  const [conectando, setConectando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const conexao = useRef<ConexaoSerial | null>(null);
  const funcao = useRef(aoLeitura);
  funcao.current = aoLeitura;
  const disponivel = serialDisponivel(ambienteAtual());

  useEffect(() => capturaGlobal().assinar((leitura) => funcao.current(leitura)), []);

  useEffect(() => {
    const atualizar = () => setFocoEmCampo(ehCampoEditavel(document.activeElement as HTMLElement | null));
    document.addEventListener("focusin", atualizar);
    document.addEventListener("focusout", atualizar);
    return () => {
      document.removeEventListener("focusin", atualizar);
      document.removeEventListener("focusout", atualizar);
    };
  }, []);

  const desconectar = useCallback(() => {
    const atual = conexao.current;
    conexao.current = null;
    setConectado(false);
    if (atual) void atual.encerrar();
  }, []);

  useEffect(() => desconectar, [desconectar]);

  const conectar = useCallback(() => {
    if (conexao.current !== null || !serialDisponivel(ambienteAtual())) return;
    setConectando(true);
    setErro(null);
    conectarSerial(ambienteAtual(), {
      aoLer: (leitura) => capturaGlobal().emitir(leitura),
      aoEncerrar: (falha) => {
        conexao.current = null;
        setConectado(false);
        if (falha !== null) setErro(mensagemDoErro(falha));
      },
    }).then(
      (nova) => {
        conexao.current = nova;
        setConectado(true);
        setConectando(false);
      },
      (falha: unknown) => {
        setConectando(false);
        if (falha instanceof DOMException && (falha.name === "NotFoundError" || falha.name === "AbortError")) return;
        setErro("Não foi possível abrir a porta serial.");
      },
    );
  }, []);

  return { pronto: !focoEmCampo, focoEmCampo, serial: { disponivel, conectado, conectando, erro, conectar, desconectar } };
}
