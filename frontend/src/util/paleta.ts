export type ComandoDeTela = { rotulo: string; caminho: string; grupo: string };

export function normalizarBusca(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

export function filtrarComandos(comandos: readonly ComandoDeTela[], texto: string): ComandoDeTela[] {
  const busca = normalizarBusca(texto);
  if (busca === "") return [...comandos];
  const pontuados: { comando: ComandoDeTela; pontos: number }[] = [];
  for (const comando of comandos) {
    const rotulo = normalizarBusca(comando.rotulo);
    const grupo = normalizarBusca(comando.grupo);
    let pontos = 0;
    if (rotulo.startsWith(busca)) pontos = 3;
    else if (rotulo.split(/\s+/).some((palavra) => palavra.startsWith(busca))) pontos = 2;
    else if (rotulo.includes(busca)) pontos = 1;
    else if (grupo.includes(busca)) pontos = 0.5;
    if (pontos > 0) pontuados.push({ comando, pontos });
  }
  return pontuados.sort((a, b) => b.pontos - a.pontos).map((p) => p.comando);
}

export function atalhoDaPaleta(evento: { key: string; ctrlKey: boolean; metaKey: boolean; altKey: boolean; shiftKey: boolean }): boolean {
  return (evento.ctrlKey || evento.metaKey) && !evento.altKey && !evento.shiftKey && evento.key.toLowerCase() === "k";
}
