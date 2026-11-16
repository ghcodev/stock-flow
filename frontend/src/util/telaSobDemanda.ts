import { lazy, type ComponentType } from "react";

export type TelaSobDemanda = {
  obter: () => ComponentType;
  carregar: () => Promise<{ default: ComponentType }>;
  falhouNaCarga: () => boolean;
};

export function criarTelaSobDemanda<N extends string>(importar: () => Promise<Record<N, ComponentType>>, nome: N): TelaSobDemanda {
  let falhou = false;
  const carregar = () =>
    importar().then(
      (modulo) => {
        falhou = false;
        return { default: modulo[nome] };
      },
      (erro: unknown) => {
        falhou = true;
        throw erro;
      },
    );
  const componente = lazy<ComponentType>(carregar);
  return { obter: () => componente, carregar, falhouNaCarga: () => falhou };
}

export function telaJaCarregada(componente: ComponentType): TelaSobDemanda {
  return { obter: () => componente, carregar: () => Promise.resolve({ default: componente }), falhouNaCarga: () => false };
}
