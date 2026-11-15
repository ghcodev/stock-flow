export class HttpError extends Error {
  readonly status: number;
  readonly codigo: string;

  constructor(status: number, codigo: string, mensagem: string) {
    super(mensagem);
    this.name = "HttpError";
    this.status = status;
    this.codigo = codigo;
  }
}

export class ConfigError extends Error {
  constructor(mensagem: string) {
    super(mensagem);
    this.name = "ConfigError";
  }
}
