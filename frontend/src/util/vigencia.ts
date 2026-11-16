export type Pedido = {
  sinal: AbortSignal;
  vigente: () => boolean;
};

export type Vigencia = {
  iniciar: () => Pedido;
  invalidar: () => void;
};

export function criarVigencia(): Vigencia {
  let atual: AbortController | null = null;
  return {
    iniciar() {
      atual?.abort();
      const controle = new AbortController();
      atual = controle;
      return { sinal: controle.signal, vigente: () => atual === controle && !controle.signal.aborted };
    },
    invalidar() {
      atual?.abort();
      atual = null;
    },
  };
}
