import { formatarInteiro } from "../util/decimal.ts";

export type OpcaoDeFiltro<V extends string> = {
  valor: V;
  rotulo: string;
  contagem: number | null;
};

type Propriedades<V extends string> = {
  rotulo: string;
  opcoes: readonly OpcaoDeFiltro<V>[];
  valor: V;
  aoMudar: (valor: V) => void;
};

export function FiltrosRapidos<V extends string>({ rotulo, opcoes, valor, aoMudar }: Propriedades<V>) {
  return (
    <div className="filtros-rapidos" role="group" aria-label={rotulo}>
      {opcoes.map((opcao) => (
        <button key={opcao.valor} type="button" className="filtro-rapido" aria-pressed={opcao.valor === valor} onClick={() => aoMudar(opcao.valor)}>
          {opcao.rotulo}
          <span className="filtro-rapido-contagem">{opcao.contagem === null ? "–" : formatarInteiro(opcao.contagem)}</span>
        </button>
      ))}
    </div>
  );
}
