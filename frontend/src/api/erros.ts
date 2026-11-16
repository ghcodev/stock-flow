import type { CampoInvalido } from "./tipos.ts";

export type MotivoDeRede = "SEM_CONEXAO" | "TEMPO_ESGOTADO" | "CANCELADO";

export class ErroDaApi extends Error {
  readonly status: number;
  readonly codigo: string;
  readonly campos: CampoInvalido[];
  readonly segundosParaRepetir: number | null;

  constructor(
    status: number,
    codigo: string,
    mensagem: string,
    campos: CampoInvalido[] = [],
    segundosParaRepetir: number | null = null,
  ) {
    super(mensagem);
    this.name = "ErroDaApi";
    this.status = status;
    this.codigo = codigo;
    this.campos = campos;
    this.segundosParaRepetir = segundosParaRepetir;
  }
}

export class ErroDeRede extends Error {
  readonly motivo: MotivoDeRede;

  constructor(motivo: MotivoDeRede, mensagem: string) {
    super(mensagem);
    this.name = "ErroDeRede";
    this.motivo = motivo;
  }
}

export function mensagemDoErro(erro: unknown): string {
  if (erro instanceof ErroDaApi) {
    if (erro.status === 429) return "Muitas tentativas. Aguarde um pouco e tente de novo.";
    if (erro.status >= 500) return "O servidor não conseguiu concluir a operação. Tente novamente.";
    return erro.message;
  }
  if (erro instanceof ErroDeRede) {
    if (erro.motivo === "TEMPO_ESGOTADO") return "O servidor demorou demais para responder. Tente novamente.";
    if (erro.motivo === "CANCELADO") return "A operação foi cancelada.";
    return "Sem conexão com o servidor. Verifique a rede e tente novamente.";
  }
  return "Não foi possível concluir a operação.";
}
