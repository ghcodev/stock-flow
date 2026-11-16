import { useEffect, useRef, useState } from "react";
import { Icone } from "./Icone.tsx";

type Propriedades = {
  rotulo: string;
  placeholder: string;
  valor: string;
  aoBuscar: (texto: string) => void;
  atrasoMs?: number;
  tamanhoMaximo?: number;
};

export function CampoDeBusca({ rotulo, placeholder, valor, aoBuscar, atrasoMs = 300, tamanhoMaximo = 100 }: Propriedades) {
  const [texto, setTexto] = useState(valor);
  const buscar = useRef(aoBuscar);
  buscar.current = aoBuscar;

  useEffect(() => {
    setTexto(valor);
  }, [valor]);

  useEffect(() => {
    if (texto.trim() === valor.trim()) return;
    const temporizador = window.setTimeout(() => buscar.current(texto.trim()), atrasoMs);
    return () => window.clearTimeout(temporizador);
  }, [texto, valor, atrasoMs]);

  return (
    <div className="busca" role="search">
      <Icone nome="search" />
      <input
        type="search"
        aria-label={rotulo}
        placeholder={placeholder}
        value={texto}
        maxLength={tamanhoMaximo}
        autoComplete="off"
        spellCheck={false}
        onChange={(evento) => setTexto(evento.target.value)}
        onKeyDown={(evento) => {
          if (evento.key === "Escape" && texto !== "") {
            evento.stopPropagation();
            setTexto("");
          }
          if (evento.key === "Enter") buscar.current(texto.trim());
        }}
      />
      {texto !== "" ? (
        <button type="button" className="busca-limpar" onClick={() => setTexto("")} aria-label="Limpar busca">
          <Icone nome="x" />
        </button>
      ) : null}
    </div>
  );
}
