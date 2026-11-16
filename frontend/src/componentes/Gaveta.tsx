import { useId, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useCamada } from "./camadas.ts";
import { Icone } from "./Icone.tsx";

type Propriedades = {
  aberta: boolean;
  titulo: string;
  subtitulo?: string | undefined;
  aoFechar: () => void;
  children: ReactNode;
  rodape?: ReactNode;
  larga?: boolean;
  bloqueada?: boolean;
};

export function Gaveta({ aberta, titulo, subtitulo, aoFechar: aoFecharPedido, children, rodape, larga, bloqueada }: Propriedades) {
  const aoFechar = bloqueada ? () => undefined : aoFecharPedido;
  const elemento = useRef<HTMLDivElement>(null);
  const idDoTitulo = useId();
  useCamada(aberta, aoFechar, elemento);

  if (!aberta) return null;
  return createPortal(
    <>
      <div className="camada-fundo" onClick={aoFechar} aria-hidden="true" />
      <div
        ref={elemento}
        className={larga ? "gaveta gaveta--larga" : "gaveta"}
        role="dialog"
        aria-modal="true"
        aria-labelledby={idDoTitulo}
        tabIndex={-1}
      >
        <header className="camada-cabecalho">
          <div>
            <h2 id={idDoTitulo}>{titulo}</h2>
            {subtitulo ? <div className="camada-subtitulo">{subtitulo}</div> : null}
          </div>
          <button type="button" className="camada-fechar" onClick={aoFechar} disabled={bloqueada} aria-label="Fechar painel">
            <Icone nome="x" />
          </button>
        </header>
        <div className="camada-corpo">{children}</div>
        {rodape ? <footer className="camada-rodape">{rodape}</footer> : null}
      </div>
    </>,
    document.body,
  );
}
