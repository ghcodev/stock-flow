export type CampoInvalido = { campo: string; mensagem: string };

export class HttpError extends Error {
  readonly status: number;
  readonly codigo: string;
  readonly campos?: CampoInvalido[];

  constructor(status: number, codigo: string, mensagem: string, campos?: CampoInvalido[]) {
    super(mensagem);
    this.name = "HttpError";
    this.status = status;
    this.codigo = codigo;
    if (campos) this.campos = campos;
  }
}

export class ConfigError extends Error {
  constructor(mensagem: string) {
    super(mensagem);
    this.name = "ConfigError";
  }
}
