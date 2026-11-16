import { useLocation } from "react-router";
import { itemDoCaminho } from "../sessao/navegacao.ts";

export function EmBreve() {
  const local = useLocation();
  const titulo = itemDoCaminho(local.pathname)?.rotulo ?? "Tela";
  return (
    <section>
      <h1>{titulo}</h1>
      <p>Esta tela será entregue em uma etapa seguinte.</p>
    </section>
  );
}
