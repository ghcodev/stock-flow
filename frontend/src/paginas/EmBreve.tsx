import { useLocation } from "react-router";
import { itemDoCaminho } from "../sessao/navegacao.ts";

export function EmBreve() {
  const local = useLocation();
  const titulo = itemDoCaminho(local.pathname)?.rotulo ?? "Tela";
  return (
    <>
      <div className="pagina-cabecalho">
        <h1>{titulo}</h1>
        <p>Esta tela será entregue em uma etapa seguinte.</p>
      </div>
      <div className="estado-vazio">
        <strong>Em construção</strong>
        <span>O conteúdo de {titulo} ainda não está disponível nesta versão.</span>
      </div>
    </>
  );
}
