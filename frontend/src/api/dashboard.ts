import type { ArquivoBaixado, Cliente } from "./cliente.ts";
import type { AlertaDeVencimento, Dashboard, Pagina } from "./tipos.ts";

const TEMPO_DA_EXPORTACAO_MS = 60_000;

export function obterDashboard(cliente: Cliente, sinal?: AbortSignal): Promise<Dashboard> {
  return cliente.get<Dashboard>("/dashboard", undefined, sinal);
}

export function listarAlertasDeVencimento(cliente: Cliente, pagina: number, limite: number, sinal?: AbortSignal): Promise<Pagina<AlertaDeVencimento>> {
  return cliente.get<Pagina<AlertaDeVencimento>>("/alertas/vencimento", { pagina, limite }, sinal);
}

export function exportarAlertasDeVencimento(cliente: Cliente, sinal?: AbortSignal): Promise<ArquivoBaixado> {
  return cliente.baixar("/alertas/vencimento/exportacao", { sinal, tempoLimiteMs: TEMPO_DA_EXPORTACAO_MS });
}
