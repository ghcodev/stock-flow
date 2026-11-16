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
