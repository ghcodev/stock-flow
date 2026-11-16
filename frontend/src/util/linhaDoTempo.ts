import type { EventoDaLinhaDoTempo } from "../api/tipos.ts";

export function alteraSaldo(evento: Pick<EventoDaLinhaDoTempo, "tipo_movimentacao" | "status_movimentacao">): boolean {
  return evento.status_movimentacao === "concluida" && (evento.tipo_movimentacao === "entrada" || evento.tipo_movimentacao === "saida" || evento.tipo_movimentacao === "ajuste");
}

export function saldoCorrenteDaLinha(eventos: readonly EventoDaLinhaDoTempo[]): string | null {
  let saldo: string | null = null;
  for (const evento of eventos) if (alteraSaldo(evento)) saldo = evento.saldo_posterior;
  return saldo;
}
