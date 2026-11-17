export type CredencialDeDemo = { rotulo: string; email: string; senha: string };

export type ModoDemo = { administrador: CredencialDeDemo; operador: CredencialDeDemo };

type Ambiente = Readonly<Record<string, unknown>>;

function texto(ambiente: Ambiente, chave: string): string {
  const valor = ambiente[chave];
  return typeof valor === "string" ? valor.trim() : "";
}

export function lerModoDemo(ambiente: Ambiente): ModoDemo | null {
  if (texto(ambiente, "VITE_MODO_DEMO") !== "true") return null;
  const administrador = { rotulo: "Administrador", email: texto(ambiente, "VITE_DEMO_ADMIN_EMAIL"), senha: texto(ambiente, "VITE_DEMO_ADMIN_SENHA") };
  const operador = { rotulo: "Operador", email: texto(ambiente, "VITE_DEMO_OPERADOR_EMAIL"), senha: texto(ambiente, "VITE_DEMO_OPERADOR_SENHA") };
  const completo = [administrador, operador].every((credencial) => credencial.email !== "" && credencial.senha !== "");
  return completo ? { administrador, operador } : null;
}
