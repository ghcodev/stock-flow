export type OpcaoDeBusca = { valor: string; rotulo: string };

export type Situacao = "ocioso" | "carregando" | "erro";

export type EstadoDoSeletor = {
  texto: string;
  consulta: number;
  consultaDasOpcoes: number | null;
  opcoes: OpcaoDeBusca[];
  ativa: number;
  situacao: Situacao;
  aberto: boolean;
};

export type AcaoDoSeletor =
  | { tipo: "digitar"; texto: string }
  | { tipo: "definirTexto"; texto: string }
  | { tipo: "abrir"; textoDaConsulta: string }
  | { tipo: "fechar" }
  | { tipo: "resposta"; consulta: number; opcoes: OpcaoDeBusca[] }
  | { tipo: "falha"; consulta: number }
  | { tipo: "mover"; delta: 1 | -1 }
  | { tipo: "apontar"; indice: number };

export function estadoInicialDoSeletor(texto: string): EstadoDoSeletor {
  return { texto, consulta: 0, consultaDasOpcoes: null, opcoes: [], ativa: -1, situacao: "ocioso", aberto: false };
}

export function opcoesVigentes(estado: EstadoDoSeletor): OpcaoDeBusca[] {
  return estado.consultaDasOpcoes === estado.consulta ? estado.opcoes : [];
}

export function opcaoEscolhivel(estado: EstadoDoSeletor, indice: number = estado.ativa): OpcaoDeBusca | null {
  if (!estado.aberto || estado.consultaDasOpcoes !== estado.consulta) return null;
  return estado.opcoes[indice] ?? null;
}

function novaConsulta(estado: EstadoDoSeletor): EstadoDoSeletor {
  return { ...estado, consulta: estado.consulta + 1, consultaDasOpcoes: null, opcoes: [], ativa: -1, situacao: "carregando", aberto: true };
}

export function reduzirSeletor(estado: EstadoDoSeletor, acao: AcaoDoSeletor): EstadoDoSeletor {
  switch (acao.tipo) {
    case "digitar":
      return novaConsulta({ ...estado, texto: acao.texto });
    case "abrir":
      return novaConsulta({ ...estado, texto: estado.texto });
    case "definirTexto":
      return { ...estado, texto: acao.texto, consulta: estado.consulta + 1, consultaDasOpcoes: null, opcoes: [], ativa: -1, situacao: "ocioso", aberto: false };
    case "fechar":
      return { ...estado, aberto: false };
    case "resposta":
      if (acao.consulta !== estado.consulta) return estado;
      return { ...estado, opcoes: acao.opcoes, consultaDasOpcoes: acao.consulta, ativa: acao.opcoes.length > 0 ? 0 : -1, situacao: "ocioso" };
    case "falha":
      if (acao.consulta !== estado.consulta) return estado;
      return { ...estado, opcoes: [], consultaDasOpcoes: acao.consulta, ativa: -1, situacao: "erro" };
    case "mover": {
      const total = opcoesVigentes(estado).length;
      if (total === 0) return estado;
      return { ...estado, ativa: (estado.ativa + acao.delta + total) % total };
    }
    case "apontar":
      return estado.consultaDasOpcoes === estado.consulta && acao.indice < estado.opcoes.length ? { ...estado, ativa: acao.indice } : estado;
  }
}
