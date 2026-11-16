import { useCallback, useEffect, useState } from "react";
import { alternarTema, gravarTema, lerTemaSalvo, resolverTema, valorDoAtributo, type Tema } from "./tema.ts";

function temaInicial(): Tema {
  const prefereEscuro = window.matchMedia("(prefers-color-scheme: dark)").matches;
  let salvo: string | null = null;
  try {
    salvo = lerTemaSalvo(window.localStorage);
  } catch {
    salvo = null;
  }
  return resolverTema(salvo, prefereEscuro);
}

export function aplicarTemaInicial(): void {
  document.documentElement.dataset["theme"] = valorDoAtributo(temaInicial());
}

export function useTema(): { tema: Tema; alternar: () => void } {
  const [tema, setTema] = useState<Tema>(temaInicial);

  useEffect(() => {
    document.documentElement.dataset["theme"] = valorDoAtributo(tema);
  }, [tema]);

  const alternar = useCallback(() => {
    const novo = alternarTema(tema);
    try {
      gravarTema(window.localStorage, novo);
    } catch {
      setTema(novo);
      return;
    }
    setTema(novo);
  }, [tema]);

  return { tema, alternar };
}
