import type { ReactNode } from "react";
import { Navigate, Outlet, useLocation } from "react-router";
import { decidirAcesso, type Recurso } from "../sessao/permissoes.ts";
import { AcessoNegado } from "../paginas/AcessoNegado.tsx";
import { useAutenticacao } from "./ContextoDeAutenticacao.tsx";

export function ExigeSessao() {
  const { sessao } = useAutenticacao();
  const local = useLocation();
  if (decidirAcesso(sessao?.usuario.perfil ?? null, undefined) === "login") {
    return <Navigate to="/entrar" replace state={{ de: local.pathname }} />;
  }
  return <Outlet />;
}

export function Protegida({ recurso, children }: { recurso: Recurso | undefined; children: ReactNode }) {
  const { sessao } = useAutenticacao();
  const local = useLocation();
  const decisao = decidirAcesso(sessao?.usuario.perfil ?? null, recurso);
  if (decisao === "login") return <Navigate to="/entrar" replace state={{ de: local.pathname }} />;
  if (decisao === "negado") return <AcessoNegado />;
  return <>{children}</>;
}
