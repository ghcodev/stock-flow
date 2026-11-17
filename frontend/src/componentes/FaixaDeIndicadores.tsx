import { useContadorAnimado } from "../hooks/useContadorAnimado.ts";
import { formatarInteiro } from "../util/decimal.ts";
import { Icone } from "./Icone.tsx";

export type Indicador = {
  rotulo: string;
  valor: number | null;
  detalhe: string;
  icone: string;
  tom?: "sucesso" | "alerta" | "perigo" | undefined;
};

function ValorAnimado({ valor }: { valor: number | null }) {
  const exibido = useContadorAnimado(valor);
  return <>{exibido === null ? "–" : formatarInteiro(exibido)}</>;
}

export function FaixaDeIndicadores({ rotulo, itens }: { rotulo: string; itens: readonly Indicador[] }) {
  return (
    <section className="indicadores" aria-label={rotulo}>
      {itens.map((item) => (
        <article
          key={item.rotulo}
          className={item.tom === "alerta" ? "indicador indicador--alerta" : item.tom === "perigo" ? "indicador indicador--perigo" : "indicador"}
        >
          <div className="indicador-rotulo">
            <Icone nome={item.icone} />
            {item.rotulo}
          </div>
          <div className={item.tom ? `indicador-valor indicador-valor--${item.tom}` : "indicador-valor"}>
            <ValorAnimado valor={item.valor} />
          </div>
          <div className="indicador-detalhe">{item.detalhe}</div>
        </article>
      ))}
    </section>
  );
}
