export type EstadoDeLista<T> = {
  chave: string;
  itens: T[];
  proximo: string | null;
  total: number | null;
  ocultos: number;
  carregando: boolean;
  erro: string | null;
};

export type AcaoDeLista<T> =
  | { tipo: "iniciar"; chave: string }
  | { tipo: "carregarMais"; chave: string }
  | { tipo: "sucesso"; chave: string; dados: T[]; proximo: string | null; total: number; anexar: boolean; maximo?: number }
  | { tipo: "falha"; chave: string; mensagem: string };

export function listaInicial<T>(): EstadoDeLista<T> {
  return { chave: "", itens: [], proximo: null, total: null, ocultos: 0, carregando: false, erro: null };
}

export function reduzirLista<T>(estado: EstadoDeLista<T>, acao: AcaoDeLista<T>): EstadoDeLista<T> {
  switch (acao.tipo) {
    case "iniciar":
      return { chave: acao.chave, itens: [], proximo: null, total: null, ocultos: 0, carregando: true, erro: null };
    case "carregarMais":
      if (acao.chave !== estado.chave || estado.carregando || estado.proximo === null) return estado;
      return { ...estado, carregando: true, erro: null };
    case "sucesso":
      if (acao.chave !== estado.chave) return estado;
      const juntos = acao.anexar ? [...estado.itens, ...acao.dados] : acao.dados;
      const excesso = acao.maximo !== undefined ? Math.max(0, juntos.length - acao.maximo) : 0;
      return {
        ...estado,
        itens: excesso > 0 ? juntos.slice(excesso) : juntos,
        ocultos: (acao.anexar ? estado.ocultos : 0) + excesso,
        proximo: acao.proximo,
        total: acao.anexar ? (estado.total ?? acao.total) : acao.total,
        carregando: false,
        erro: null,
      };
    case "falha":
      if (acao.chave !== estado.chave) return estado;
      return { ...estado, carregando: false, erro: acao.mensagem };
  }
}
