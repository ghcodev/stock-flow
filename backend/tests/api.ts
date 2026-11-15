import type { Servidor } from "./helpers.ts";

export type RespostaApi = { status: number; corpo: unknown; texto: string };

export async function chamarApi(
  servidor: Servidor,
  metodo: string,
  caminho: string,
  token?: string,
  corpo?: unknown,
): Promise<RespostaApi> {
  const res = await fetch(`${servidor.url}${caminho}`, {
    method: metodo,
    headers: {
      ...(corpo === undefined ? {} : { "content-type": "application/json" }),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    ...(corpo === undefined ? {} : { body: JSON.stringify(corpo) }),
  });
  const texto = await res.text();
  let parseado: unknown = null;
  try {
    parseado = JSON.parse(texto);
  } catch {
    parseado = null;
  }
  return { status: res.status, corpo: parseado, texto };
}
