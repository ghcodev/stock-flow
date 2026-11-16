import { lazy, type ComponentType } from "react";

export type TelaSobDemanda = {
  obter: () => ComponentType;
  renovar: () => void;
};

export function criarTelaSobDemanda<N extends string>(importar: () => Promise<Record<N, ComponentType>>, nome: N): TelaSobDemanda {
  const criar = () => lazy<ComponentType>(() => importar().then((modulo) => ({ default: modulo[nome] })));
  let atual = criar();
  return {
    obter: () => atual,
    renovar: () => {
      atual = criar();
    },
  };
}
