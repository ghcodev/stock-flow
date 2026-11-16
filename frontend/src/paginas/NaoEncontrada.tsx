import { Link } from "react-router";

export function NaoEncontrada() {
  return (
    <>
      <div className="pagina-cabecalho">
        <h1>Página não encontrada</h1>
        <p>O endereço acessado não existe.</p>
      </div>
      <div className="estado-vazio">
        <strong>Nada por aqui</strong>
        <Link to="/">Voltar ao dashboard</Link>
      </div>
    </>
  );
}
