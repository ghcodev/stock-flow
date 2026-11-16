import { formatarInteiro } from "../util/decimal.ts";
import { Icone } from "./Icone.tsx";

type Propriedades = {
  exibidos: number;
  total: number | null;
  haMais: boolean;
  carregando: boolean;
  erro: string | null;
  aoCarregarMais: () => void;
};

export function CarregarMais({ exibidos, total, haMais, carregando, erro, aoCarregarMais }: Propriedades) {
  return (
    <div className="carregar-mais">
      <span aria-live="polite">
        Exibindo <strong>{formatarInteiro(exibidos)}</strong>
        {total !== null ? (
          <>
            {" "}
            de <strong>{formatarInteiro(total)}</strong>
          </>
        ) : null}
      </span>
      {erro && exibidos > 0 ? (
        <span className="carregar-mais-erro" role="alert">
          {erro}
        </span>
      ) : null}
      {haMais ? (
        <button type="button" className="btn btn-outline btn-sm" onClick={aoCarregarMais} disabled={carregando} aria-busy={carregando}>
          {carregando ? <span className="spinner" aria-hidden="true" /> : <Icone nome="chevron-down" />}
          {carregando ? "Carregando…" : erro ? "Tentar novamente" : "Carregar mais"}
        </button>
      ) : null}
    </div>
  );
}
