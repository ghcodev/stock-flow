import { formatarInteiro } from "../util/decimal.ts";
import { Icone } from "./Icone.tsx";

type Propriedades = {
  exibidos: number;
  total: number | null;
  ocultos?: number;
  haMais: boolean;
  carregando: boolean;
  erro: string | null;
  aoCarregarMais: () => void;
  aoVoltarAoInicio: () => void;
};

export function CarregarMais({ exibidos, total, ocultos = 0, haMais, carregando, erro, aoCarregarMais, aoVoltarAoInicio }: Propriedades) {
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
      {ocultos > 0 ? (
        <span className="carregar-mais-erro carregar-mais-nota">
          {formatarInteiro(ocultos)} dos primeiros registros carregados foram ocultados para manter a tela rápida.
          <button type="button" className="btn btn-outline btn-sm" onClick={aoVoltarAoInicio}>
            Voltar ao início
          </button>
        </span>
      ) : null}
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
