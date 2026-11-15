export function jsonReplacer(_chave: string, valor: unknown): unknown {
  return typeof valor === "bigint" ? valor.toString() : valor;
}
