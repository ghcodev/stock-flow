import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent as EventoDeTeclado } from "react";
import { createPortal } from "react-dom";
import { Icone } from "./Icone.tsx";

export type ItemDeMenu = {
  rotulo: string;
  icone?: string;
  perigo?: boolean;
  desabilitado?: boolean;
  aoSelecionar: () => void;
};

type Posicao = { topo: number; direita: number };

const LARGURA_ESTIMADA = 200;
const ALTURA_ITEM = 32;

export function MenuDeAcoes({ rotulo, itens }: { rotulo: string; itens: ItemDeMenu[] }) {
  const [aberto, setAberto] = useState(false);
  const [posicao, setPosicao] = useState<Posicao>({ topo: 0, direita: 0 });
  const botao = useRef<HTMLButtonElement>(null);
  const lista = useRef<HTMLDivElement>(null);
  const idDoMenu = useId();

  const fechar = useCallback((devolverFoco: boolean) => {
    setAberto(false);
    if (devolverFoco) botao.current?.focus();
  }, []);

  const abrir = () => {
    const caixa = botao.current?.getBoundingClientRect();
    if (!caixa) return;
    const alturaDoMenu = itens.length * ALTURA_ITEM + 8;
    const abaixo = caixa.bottom + 4;
    const topo = abaixo + alturaDoMenu > window.innerHeight ? Math.max(8, caixa.top - alturaDoMenu - 4) : abaixo;
    const direita = Math.max(8, Math.min(window.innerWidth - caixa.right, window.innerWidth - LARGURA_ESTIMADA));
    setPosicao({ topo, direita });
    setAberto(true);
  };

  useEffect(() => {
    if (!aberto) return;
    lista.current?.querySelector<HTMLElement>('[role="menuitem"]:not([disabled])')?.focus();
    const aoClicarFora = (evento: MouseEvent) => {
      const alvo = evento.target;
      if (alvo instanceof Node && !lista.current?.contains(alvo) && !botao.current?.contains(alvo)) fechar(false);
    };
    const aoRolar = () => fechar(false);
    document.addEventListener("mousedown", aoClicarFora);
    window.addEventListener("scroll", aoRolar, true);
    window.addEventListener("resize", aoRolar);
    return () => {
      document.removeEventListener("mousedown", aoClicarFora);
      window.removeEventListener("scroll", aoRolar, true);
      window.removeEventListener("resize", aoRolar);
    };
  }, [aberto, fechar]);

  const aoTeclarNoMenu = (evento: EventoDeTeclado<HTMLDivElement>) => {
    const habilitados = Array.from(evento.currentTarget.querySelectorAll<HTMLElement>('[role="menuitem"]:not([disabled])'));
    const atual = habilitados.indexOf(document.activeElement as HTMLElement);
    if (evento.key === "Escape") {
      evento.preventDefault();
      evento.stopPropagation();
      fechar(true);
    } else if (evento.key === "Tab") {
      fechar(false);
    } else if (evento.key === "ArrowDown") {
      evento.preventDefault();
      habilitados[(atual + 1) % habilitados.length]?.focus();
    } else if (evento.key === "ArrowUp") {
      evento.preventDefault();
      habilitados[(atual - 1 + habilitados.length) % habilitados.length]?.focus();
    } else if (evento.key === "Home") {
      evento.preventDefault();
      habilitados[0]?.focus();
    } else if (evento.key === "End") {
      evento.preventDefault();
      habilitados[habilitados.length - 1]?.focus();
    }
  };

  return (
    <>
      <button
        ref={botao}
        type="button"
        className="icon-btn"
        aria-label={rotulo}
        aria-haspopup="menu"
        aria-expanded={aberto}
        aria-controls={aberto ? idDoMenu : undefined}
        onClick={() => (aberto ? fechar(false) : abrir())}
        onKeyDown={(evento) => {
          if (evento.key === "ArrowDown" && !aberto) {
            evento.preventDefault();
            abrir();
          }
        }}
      >
        <Icone nome="more-vertical" />
      </button>
      {aberto
        ? createPortal(
            <div
              ref={lista}
              id={idDoMenu}
              role="menu"
              aria-label={rotulo}
              className="menu-de-acoes"
              style={{ top: posicao.topo, right: posicao.direita }}
              onKeyDown={aoTeclarNoMenu}
            >
              {itens.map((item) => (
                <button
                  key={item.rotulo}
                  type="button"
                  role="menuitem"
                  className={item.perigo ? "menu-de-acoes-item menu-de-acoes-item--perigo" : "menu-de-acoes-item"}
                  disabled={item.desabilitado}
                  onClick={() => {
                    fechar(true);
                    item.aoSelecionar();
                  }}
                >
                  {item.icone ? <Icone nome={item.icone} /> : null}
                  {item.rotulo}
                </button>
              ))}
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
