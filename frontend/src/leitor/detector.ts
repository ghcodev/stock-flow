export type OrigemDaLeitura = "leitor" | "digitacao" | "serial";

export type Leitura = {
  codigo: string;
  origem: OrigemDaLeitura;
  intervaloMedioMs: number | null;
};

export type OpcoesDoDetector = {
  limiteMs: number;
  tamanhoMinimo: number;
  esperaMaximaMs: number;
  tamanhoMaximo: number;
};

export const OPCOES_PADRAO: OpcoesDoDetector = { limiteMs: 30, tamanhoMinimo: 4, esperaMaximaMs: 1500, tamanhoMaximo: 256 };

type Tecla = { tecla: string; instante: number };

export type Detector = {
  tecla: (tecla: string, instante: number) => Leitura | null;
  reiniciar: () => void;
  pendentes: () => number;
};

export function criarDetector(opcoes: OpcoesDoDetector = OPCOES_PADRAO): Detector {
  let teclas: Tecla[] = [];

  return {
    tecla(tecla, instante) {
      if (tecla !== "Enter") {
        if (tecla.length !== 1) return null;
        const ultima = teclas[teclas.length - 1];
        if (ultima && instante - ultima.instante > opcoes.esperaMaximaMs) teclas = [];
        if (teclas.length >= opcoes.tamanhoMaximo) teclas = [];
        teclas.push({ tecla, instante });
        return null;
      }
      const codigo = teclas.map((t) => t.tecla).join("");
      const intervalos = teclas.slice(1).map((t, indice) => t.instante - (teclas[indice]?.instante ?? t.instante));
      const media = intervalos.length > 0 ? intervalos.reduce((soma, valor) => soma + valor, 0) / intervalos.length : Infinity;
      teclas = [];
      if (codigo.length < opcoes.tamanhoMinimo) return null;
      return {
        codigo,
        origem: media <= opcoes.limiteMs ? "leitor" : "digitacao",
        intervaloMedioMs: Number.isFinite(media) ? Math.round(media * 10) / 10 : null,
      };
    },
    reiniciar() {
      teclas = [];
    },
    pendentes() {
      return teclas.length;
    },
  };
}
