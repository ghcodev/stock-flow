import { Link } from "react-router";

export function NaoEncontrada() {
  return (
    <section>
      <h1>Página não encontrada</h1>
      <p>O endereço acessado não existe.</p>
      <Link to="/">Voltar ao dashboard</Link>
    </section>
  );
}
