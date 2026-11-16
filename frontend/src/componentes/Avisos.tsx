import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Icone } from "./Icone.tsx";

export type TipoDeAviso = "sucesso" | "erro" | "info";

type Aviso = { id: number; tipo: TipoDeAviso; titulo: string; mensagem?: string | undefined };

type Valor = {
  mostrar: (tipo: TipoDeAviso, titulo: string, mensagem?: string) => void;
};

const DURACAO_MS = 6000;
const ICONES: Record<TipoDeAviso, string> = { sucesso: "circle-check", erro: "alert-triangle", info: "info" };

const Contexto = createContext<Valor | null>(null);

export function ProvedorDeAvisos({ children }: { children: ReactNode }) {
  const [avisos, setAvisos] = useState<Aviso[]>([]);
  const proximo = useRef(1);
  const temporizadores = useRef(new Map<number, number>());

  useEffect(() => {
    const ativos = temporizadores.current;
    return () => {
      for (const temporizador of ativos.values()) window.clearTimeout(temporizador);
      ativos.clear();
    };
  }, []);

  const remover = useCallback((id: number) => {
    const temporizador = temporizadores.current.get(id);
    if (temporizador !== undefined) window.clearTimeout(temporizador);
    temporizadores.current.delete(id);
    setAvisos((atuais) => atuais.filter((a) => a.id !== id));
  }, []);

  const mostrar = useCallback(
    (tipo: TipoDeAviso, titulo: string, mensagem?: string) => {
      const id = proximo.current++;
      setAvisos((atuais) => [...atuais.slice(-3), { id, tipo, titulo, mensagem }]);
      temporizadores.current.set(id, window.setTimeout(() => remover(id), DURACAO_MS));
    },
    [remover],
  );

  const valor = useMemo(() => ({ mostrar }), [mostrar]);

  return (
    <Contexto.Provider value={valor}>
      {children}
      <div className="avisos" role="status" aria-live="polite" aria-atomic="false">
        {avisos.map((aviso) => (
          <div key={aviso.id} className={`aviso aviso--${aviso.tipo}`}>
            <div className="aviso-icone">
              <Icone nome={ICONES[aviso.tipo]} />
            </div>
            <div className="aviso-corpo">
              <div className="aviso-titulo">{aviso.titulo}</div>
              {aviso.mensagem ? <div className="aviso-mensagem">{aviso.mensagem}</div> : null}
            </div>
            <button type="button" className="aviso-fechar" onClick={() => remover(aviso.id)} aria-label="Dispensar aviso">
              <Icone nome="x" />
            </button>
          </div>
        ))}
      </div>
    </Contexto.Provider>
  );
}

export function useAvisos(): Valor {
  const valor = useContext(Contexto);
  if (valor === null) throw new Error("useAvisos fora do ProvedorDeAvisos");
  return valor;
}
