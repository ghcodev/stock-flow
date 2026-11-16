import { useEffect, useState } from "react";

const FORMATO = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });

export function useHorarioDoSucesso(dados: unknown): string | null {
  const [horario, setHorario] = useState<string | null>(null);
  useEffect(() => {
    if (dados !== null && dados !== undefined) setHorario(FORMATO.format(new Date()));
  }, [dados]);
  return horario;
}
