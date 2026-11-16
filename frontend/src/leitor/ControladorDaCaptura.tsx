import { useEffect, useRef } from "react";
import { useLocation } from "react-router";
import { useAutenticacao } from "../autenticacao/ContextoDeAutenticacao.tsx";
import { capturaPermitida } from "../sessao/rotas.ts";
import { capturaGlobal } from "./captura.ts";

export function ControladorDaCaptura(): null {
  const { sessao } = useAutenticacao();
  const { pathname } = useLocation();
  const perfil = sessao?.usuario.perfil ?? null;
  const anterior = useRef<string | null>(null);

  useEffect(() => {
    const captura = capturaGlobal();
    if (anterior.current !== null && anterior.current !== pathname) captura.reiniciar();
    anterior.current = pathname;
    captura.habilitar(capturaPermitida(perfil, pathname));
  }, [perfil, pathname]);

  return null;
}
