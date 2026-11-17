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
  validade_expirada?: boolean | undefined;
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

export type Indicadores = {
  produtos: number;
  lotes: number;
  vencidos: number;
  bloqueados: number;
  movimentacoes: number;
  divergencias: number;
};

export type PontoDoGrafico = {
  dia: string;
  tipo: TipoMovimentacao;
  total: number;
};

export type AlertaDeEstoqueMinimo = {
  id_produto: number;
  nome: string;
  unidade_medida: string;
  estoque_minimo: string;
  saldo_ativo: string;
};

export type LotesPorSituacao = { ativo: number; bloqueado: number; vencido: number; vencendo: number };

export type SaldoDeCategoria = { categoria: string; saldo_kg: string };

export type ProdutoMovimentado = { id_produto: number; nome: string; movimentacoes: number };

export type Dashboard = {
  data_referencia: string;
  lotes_por_situacao: LotesPorSituacao;
  saldo_por_categoria: SaldoDeCategoria[];
  saldo_por_categoria_lotes_fora: number;
  top_produtos: ProdutoMovimentado[];
  indicadores: Indicadores;
  grafico: PontoDoGrafico[];
  alertas_estoque_minimo: { total: number; itens: AlertaDeEstoqueMinimo[] };
};

export type AlertaDeVencimento = {
  id_lote: number;
  numero_lote: string;
  data_validade: string;
  dias_restantes: number;
  quantidade: string;
  produto: string;
  unidade_medida: string;
  corredor: string;
  nivel: string;
  posicao: string;
};

export type ValorJson = string | number | boolean | null | ValorJson[] | { [chave: string]: ValorJson };

export type RegistroDeAuditoria = {
  id_log: string;
  tabela_afetada: string;
  operacao: "INSERT" | "UPDATE" | "DELETE";
  valor_anterior: ValorJson | null;
  valor_novo: ValorJson | null;
  id_usuario: number | null;
  nome_usuario: string | null;
  data_hora: string;
  ip_usuario: string | null;
  observacao: string | null;
};

export type MovimentacaoDoHistorico = Movimentacao & {
  numero_lote: string;
  nome_usuario: string;
};

export type PosicaoDoEvento = {
  id_localizacao: number;
  corredor: string;
  nivel: string;
  posicao: string;
};

export type EventoDaLinhaDoTempo = {
  id_movimentacao: string;
  data_movimentacao: string;
  tipo_movimentacao: TipoMovimentacao;
  status_movimentacao: string;
  quantidade: string;
  saldo_anterior: string;
  saldo_posterior: string;
  usuario: { id_usuario: number; nome: string };
  origem: PosicaoDoEvento | null;
  destino: PosicaoDoEvento | null;
  motivo_movimentacao: string | null;
  observacao: string | null;
};

export type Rastreabilidade = {
  lote: Lote;
  linha_do_tempo: EventoDaLinhaDoTempo[];
  pagina: number;
  limite: number;
  total: number;
  proximo_depois_de_id: string | null;
};

export type Usuario = {
  id_usuario: number;
  nome: string;
  email: string;
  perfil: Perfil;
  ativo: boolean;
};

export type StatusDeContagem = "pendente" | "concluida" | "cancelada";

export type Contagem = MovimentacaoDoHistorico & { divergencia: string };

export type ResultadoDeFinalizacao = {
  contagem: Contagem;
  ajuste: Movimentacao | null;
  divergencia: string;
  saldo_final: string;
};
