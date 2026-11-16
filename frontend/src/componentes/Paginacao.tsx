import { formatarInteiro } from "../util/decimal.ts";
import { janelaDePaginas, limitesDaPagina, ultimaPagina } from "../util/paginacao.ts";
import { Icone } from "./Icone.tsx";

type Propriedades = {
  pagina: number;
  limite: number;
  total: number;
  carregando: boolean;
  aoMudar: (pagina: number) => void;
};

export function Paginacao({ pagina, limite, total, carregando, aoMudar }: Propriedades) {
  const ultima = ultimaPagina(total, limite);
  const { primeiro: primeiroItem, ultimo: ultimoItem } = limitesDaPagina(pagina, limite, total);
  return (
    <nav className="paginacao" aria-label="Paginação">
      <span aria-live="polite">
        Exibindo <strong>{formatarInteiro(primeiroItem)}</strong>–<strong>{formatarInteiro(ultimoItem)}</strong> de <strong>{formatarInteiro(total)}</strong>
      </span>
      <div className="paginacao-controles">
        <button type="button" className="paginacao-botao" onClick={() => aoMudar(pagina - 1)} disabled={pagina <= 1 || carregando} aria-label="Página anterior">
          <Icone nome="chevron-left" />
        </button>
        {janelaDePaginas(pagina, ultima).map((numero) => (
          <button
            key={numero}
            type="button"
            className="paginacao-botao"
            onClick={() => aoMudar(numero)}
            disabled={carregando}
            aria-current={numero === pagina ? "page" : undefined}
            aria-label={`Página ${numero}`}
          >
            {numero}
          </button>
        ))}
        <button type="button" className="paginacao-botao" onClick={() => aoMudar(pagina + 1)} disabled={pagina >= ultima || carregando} aria-label="Próxima página">
          <Icone nome="chevron-right" />
        </button>
      </div>
    </nav>
  );
}
