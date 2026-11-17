export type CredencialDeDemo = { rotulo: string; email: string; senha: string };

export type ModoDemo = { administrador: CredencialDeDemo; operador: CredencialDeDemo };

export type ValoresDeDemo = {
  adminEmail: unknown;
  adminSenha: unknown;
  operadorEmail: unknown;
  operadorSenha: unknown;
};

function texto(valor: unknown): string {
  return typeof valor === "string" ? valor.trim() : "";
}

export function montarModoDemo(valores: ValoresDeDemo): ModoDemo | null {
  const administrador = { rotulo: "Administrador", email: texto(valores.adminEmail), senha: texto(valores.adminSenha) };
  const operador = { rotulo: "Operador", email: texto(valores.operadorEmail), senha: texto(valores.operadorSenha) };
  const completo = [administrador, operador].every((credencial) => credencial.email !== "" && credencial.senha !== "");
  return completo ? { administrador, operador } : null;
}
