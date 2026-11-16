import { Link } from "react-router";

export function AcessoNegado() {
  return (
    <>
      <div className="pagina-cabecalho">
        <h1>Acesso negado</h1>
        <p>Seu perfil não tem permissão para abrir esta tela.</p>
      </div>
      <div className="estado-vazio" role="alert">
        <strong>Permissão insuficiente</strong>
        <Link to="/">Voltar ao dashboard</Link>
      </div>
    </>
  );
}
