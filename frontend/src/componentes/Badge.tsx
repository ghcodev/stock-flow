import type { ReactNode } from "react";

export type TomDeBadge = "sucesso" | "perigo" | "alerta" | "info" | "neutro" | "admin";

export function Badge({ tom, children, ponto }: { tom: TomDeBadge; children: ReactNode; ponto?: boolean }) {
  return (
    <span className={`badge badge--${tom}`}>
      {ponto ? <span className="badge-ponto" aria-hidden="true" /> : null}
      {children}
    </span>
  );
}
