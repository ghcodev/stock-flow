import { Fragment, type ReactNode } from "react";

export type ItemDeResumo = { texto: ReactNode; tom?: "perigo" | "alerta" | undefined };

export function CabecalhoDePagina({ titulo, resumo, acoes }: { titulo: string; resumo?: readonly ItemDeResumo[]; acoes?: ReactNode }) {
  return (
    <div className="pagina-cabecalho pagina-cabecalho--linha">
      <div>
        <h1>{titulo}</h1>
        {resumo && resumo.length > 0 ? (
          <div className="pagina-cabecalho-subtitulo">
            {resumo.map((item, indice) => (
              <Fragment key={indice}>
                {indice > 0 ? <span className="pagina-cabecalho-sep" aria-hidden="true" /> : null}
                <span>{item.texto}</span>
              </Fragment>
            ))}
          </div>
        ) : null}
      </div>
      {acoes ? <div className="pagina-cabecalho-acoes">{acoes}</div> : null}
    </div>
  );
}
