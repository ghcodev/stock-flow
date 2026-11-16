import { useId, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useCamada } from "./camadas.ts";
import { Icone } from "./Icone.tsx";

type Propriedades = {
  aberto: boolean;
  titulo: string;
  aoFechar: () => void;
  children: ReactNode;
  rodape?: ReactNode;
  bloqueado?: boolean;
};

export function Modal({ aberto, titulo, aoFechar: aoFecharPedido, children, rodape, bloqueado }: Propriedades) {
  const aoFechar = bloqueado ? () => undefined : aoFecharPedido;
  const elemento = useRef<HTMLDivElement>(null);
  const idDoTitulo = useId();
  useCamada(aberto, aoFechar, elemento);

  if (!aberto) return null;
  return createPortal(
    <>
      <div className="camada-fundo camada-fundo--modal" onClick={aoFechar} aria-hidden="true" />
      <div className="modal-posicao">
        <div ref={elemento} className="modal" role="dialog" aria-modal="true" aria-labelledby={idDoTitulo} tabIndex={-1}>
          <header className="camada-cabecalho">
            <h2 id={idDoTitulo}>{titulo}</h2>
            <button type="button" className="camada-fechar" onClick={aoFechar} disabled={bloqueado} aria-label="Fechar janela">
              <Icone nome="x" />
            </button>
          </header>
          <div className="camada-corpo">{children}</div>
          {rodape ? <footer className="camada-rodape">{rodape}</footer> : null}
        </div>
      </div>
    </>,
    document.body,
  );
}
