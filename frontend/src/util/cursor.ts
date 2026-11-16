export type EstadoDeLista<T> = {
  chave: string;
  itens: T[];
  proximo: string | null;
  total: number | null;
  carregando: boolean;
  erro: string | null;
};

export type AcaoDeLista<T> =
  | { tipo: "iniciar"; chave: string }
  | { tipo: "carregarMais"; chave: string }
  | { tipo: "sucesso"; chave: string; dados: T[]; proximo: string | null; total: number; anexar: boolean }
  | { tipo: "falha"; chave: string; mensagem: string };

export function listaInicial<T>(): EstadoDeLista<T> {
  return { chave: "", itens: [], proximo: null, total: null, carregando: false, erro: null };
}

export function reduzirLista<T>(estado: EstadoDeLista<T>, acao: AcaoDeLista<T>): EstadoDeLista<T> {
  switch (acao.tipo) {
    case "iniciar":
      return { chave: acao.chave, itens: [], proximo: null, total: null, carregando: true, erro: null };
    case "carregarMais":
      if (acao.chave !== estado.chave || estado.carregando || estado.proximo === null) return estado;
      return { ...estado, carregando: true, erro: null };
    case "sucesso":
      if (acao.chave !== estado.chave) return estado;
      return {
        ...estado,
        itens: acao.anexar ? [...estado.itens, ...acao.dados] : acao.dados,
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
