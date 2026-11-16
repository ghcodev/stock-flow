export type EnvioUnico = {
  executar: <T>(tarefa: () => Promise<T>) => Promise<T> | null;
  ocupado: () => boolean;
};

export function criarEnvioUnico(): EnvioUnico {
  let ocupado = false;
  return {
    executar<T>(tarefa: () => Promise<T>): Promise<T> | null {
      if (ocupado) return null;
      ocupado = true;
      let promessa: Promise<T>;
      try {
        promessa = tarefa();
      } catch (erro) {
        ocupado = false;
        return Promise.reject(erro);
      }
      return promessa.finally(() => {
        ocupado = false;
      });
    },
    ocupado: () => ocupado,
  };
}

export type FiltroDeLeituraDupla = (codigo: string, agoraMs: number) => boolean;

export function criarFiltroDeLeituraDupla(janelaMs: number): FiltroDeLeituraDupla {
  let ultimoCodigo = "";
  let ultimoInstante = Number.NEGATIVE_INFINITY;
  return (codigo, agoraMs) => {
    const repetida = codigo === ultimoCodigo && agoraMs - ultimoInstante < janelaMs;
    ultimoCodigo = codigo;
    ultimoInstante = agoraMs;
    return !repetida;
  };
}
