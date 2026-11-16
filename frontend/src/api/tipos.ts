export type Perfil = "administrador" | "operador";

export type UsuarioPublico = {
  id_usuario: number;
  nome: string;
  email: string;
  perfil: Perfil;
};

export type ResultadoLogin = {
  token: string;
  usuario: UsuarioPublico;
};

export type CampoInvalido = {
  campo: string;
  mensagem: string;
};

export type CorpoDeErro = {
  erro: {
    codigo: string;
    mensagem: string;
    campos?: CampoInvalido[];
  };
};

export type Pagina<T> = {
  dados: T[];
  pagina: number;
  limite: number;
  total: number;
};

export type ValorDeConsulta = string | number | boolean | null | undefined;

export type Consulta = Record<string, ValorDeConsulta>;

export type Produto = {
  id_produto: number;
  nome: string;
  categoria: string | null;
  descricao: string | null;
  unidade_medida: string;
  estoque_minimo: string;
  ativo: boolean;
  created_at: string;
};

export type Localizacao = {
  id_localizacao: number;
  corredor: string;
  nivel: string;
  posicao: string;
  capacidade: string | null;
  descricao: string | null;
};

export type StatusLote = "ativo" | "bloqueado" | "vencido";

export type TipoEtiqueta = "qr_code" | "rfid";

export type Etiqueta = {
  id_identificacao: number;
  tipo_identificacao: TipoEtiqueta;
  codigo: string;
};

export type Lote = {
  id_lote: number;
  numero_lote: string;
  data_fabricacao: string | null;
  data_validade: string | null;
  quantidade: string;
  status_lote: StatusLote;
  data_bloqueio: string | null;
  motivo_bloqueio: string | null;
  id_produto: number;
  id_localizacao: number;
  produto: { id_produto: number; nome: string; unidade_medida: string };
  localizacao: { id_localizacao: number; corredor: string; nivel: string; posicao: string };
  identificacao: Etiqueta | null;
};

export type TipoMovimentacao = "entrada" | "saida" | "transferencia" | "ajuste" | "inventario";

export type Movimentacao = {
  id_movimentacao: string;
  tipo_movimentacao: TipoMovimentacao;
  data_movimentacao: string;
  quantidade: string;
  saldo_anterior: string;
  saldo_posterior: string;
  id_lote: number;
  id_usuario: number;
  id_localizacao_origem: number | null;
  id_localizacao_destino: number | null;
  motivo_movimentacao: string | null;
  observacao: string | null;
  status_movimentacao: string;
};
