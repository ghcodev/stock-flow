export type Tema = "claro" | "escuro";

export const CHAVE_DO_TEMA = "sf.tema";

export function resolverTema(salvo: string | null, prefereEscuro: boolean): Tema {
  if (salvo === "claro" || salvo === "escuro") return salvo;
  return prefereEscuro ? "escuro" : "claro";
}

export function valorDoAtributo(tema: Tema): "light" | "dark" {
  return tema === "escuro" ? "dark" : "light";
}

export function alternarTema(tema: Tema): Tema {
  return tema === "escuro" ? "claro" : "escuro";
}

type Leitura = { getItem: (chave: string) => string | null };
type Gravacao = { setItem: (chave: string, valor: string) => void };

export function lerTemaSalvo(armazenamento: Leitura): string | null {
  try {
    return armazenamento.getItem(CHAVE_DO_TEMA);
  } catch {
    return null;
  }
}

export function gravarTema(armazenamento: Gravacao, tema: Tema): void {
  try {
    armazenamento.setItem(CHAVE_DO_TEMA, tema);
  } catch {
    return;
  }
}
