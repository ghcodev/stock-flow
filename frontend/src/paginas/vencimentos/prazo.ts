import type { TomDeBadge } from "../../componentes/Badge.tsx";

export function tomDoPrazo(diasRestantes: number): TomDeBadge {
  if (diasRestantes <= 3) return "perigo";
  if (diasRestantes <= 7) return "alerta";
  return "info";
}

export function textoDoPrazo(diasRestantes: number): string {
  if (diasRestantes <= 0) return "vence hoje";
  return diasRestantes === 1 ? "1 dia" : `${diasRestantes} dias`;
}
