import { Navigate, Outlet, useLocation } from "react-router";
import { decidirAcesso } from "../sessao/permissoes.ts";
import { itemDoCaminho } from "../sessao/navegacao.ts";
import { AcessoNegado } from "../paginas/AcessoNegado.tsx";
import { useAutenticacao } from "./ContextoDeAutenticacao.tsx";

export function ExigeSessao() {
  const { sessao } = useAutenticacao();
  const local = useLocation();
  if (decidirAcesso(sessao?.usuario.perfil ?? null) === "login") {
    return <Navigate to="/entrar" replace state={{ de: local.pathname }} />;
  }
  return <Outlet />;
}

export function ExigePermissao() {
  const { sessao } = useAutenticacao();
  const local = useLocation();
  const recurso = itemDoCaminho(local.pathname)?.recurso;
  const decisao = decidirAcesso(sessao?.usuario.perfil ?? null, recurso);
  if (decisao === "login") return <Navigate to="/entrar" replace state={{ de: local.pathname }} />;
  if (decisao === "negado") return <AcessoNegado />;
  return <Outlet />;
}
