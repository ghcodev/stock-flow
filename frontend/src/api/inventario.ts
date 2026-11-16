import type { Cliente } from "./cliente.ts";
import type { Contagem, Movimentacao, Pagina, ResultadoDeFinalizacao, StatusDeContagem } from "./tipos.ts";
import { idDeContagemValido, type corpoDeContagem } from "../util/inventario.ts";

function exigirId(id: string): void {
  if (!idDeContagemValido(id)) throw new Error("Identificador de contagem inválido");
}

export function listarContagens(cliente: Cliente, status: StatusDeContagem, pagina: number, limite: number, sinal?: AbortSignal): Promise<Pagina<Contagem>> {
  return cliente.get<Pagina<Contagem>>("/inventario/contagens", { status, pagina, limite }, sinal);
}

export function registrarContagem(cliente: Cliente, corpo: ReturnType<typeof corpoDeContagem>): Promise<Movimentacao & { divergencia: string }> {
  return cliente.post<Movimentacao & { divergencia: string }>("/inventario/contagens", corpo);
}

export function finalizarContagem(cliente: Cliente, id: string): Promise<ResultadoDeFinalizacao> {
  exigirId(id);
  return cliente.post<ResultadoDeFinalizacao>(`/inventario/contagens/${id}/finalizar`);
}

export function cancelarContagem(cliente: Cliente, id: string): Promise<Contagem> {
  exigirId(id);
  return cliente.post<Contagem>(`/inventario/contagens/${id}/cancelar`);
}
