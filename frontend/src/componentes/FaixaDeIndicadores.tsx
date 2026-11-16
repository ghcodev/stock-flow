import { Icone } from "./Icone.tsx";

export type Indicador = {
  rotulo: string;
  valor: number | null;
  detalhe: string;
  icone: string;
  tom?: "sucesso" | "alerta" | "perigo" | undefined;
};

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
            {item.valor === null ? "–" : new Intl.NumberFormat("pt-BR").format(item.valor)}
          </div>
          <div className="indicador-detalhe">{item.detalhe}</div>
        </article>
      ))}
    </section>
  );
}
