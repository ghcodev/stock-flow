import { useCallback, useEffect, useReducer, useRef } from "react";
import { obterLote } from "../api/lotes.ts";
import type { Lote } from "../api/tipos.ts";
import { useAutenticacao } from "../autenticacao/ContextoDeAutenticacao.tsx";
import { podeEscreverNoLote, reduzirLeitura, type EstadoDaLeitura } from "../util/leituraDoLote.ts";
import { criarVigencia } from "../util/vigencia.ts";

export type LeituraAtual = {
  lote: Lote | null;
  estado: EstadoDaLeitura | null;
  podeEscrever: boolean;
  escolher: (lote: Lote) => void;
  limpar: () => void;
  reler: (id: number) => void;
};

export function useLeituraDoLote(): LeituraAtual {
  const { cliente } = useAutenticacao();
  const [leitura, despachar] = useReducer(reduzirLeitura, null);
  const vigencia = useRef(criarVigencia());

  useEffect(() => {
    const atual = vigencia.current;
    return () => atual.invalidar();
  }, []);

  const escolher = useCallback((lote: Lote) => {
    vigencia.current.invalidar();
    despachar({ tipo: "escolher", lote });
  }, []);

  const limpar = useCallback(() => {
    vigencia.current.invalidar();
    despachar({ tipo: "limpar" });
  }, []);

  const reler = useCallback(
    (id: number) => {
      const pedido = vigencia.current.iniciar();
      despachar({ tipo: "reler", id });
      obterLote(cliente, id, pedido.sinal).then(
        (lote) => {
          if (pedido.vigente()) despachar({ tipo: "recebida", lote });
        },
        () => {
          if (pedido.vigente()) despachar({ tipo: "falhou", id });
        },
      );
    },
    [cliente],
  );

  return { lote: leitura?.lote ?? null, estado: leitura?.estado ?? null, podeEscrever: podeEscreverNoLote(leitura), escolher, limpar, reler };
}
