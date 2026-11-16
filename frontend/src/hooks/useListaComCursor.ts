import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { ErroDeRede, mensagemDoErro } from "../api/erros.ts";
import { listaInicial, reduzirLista, type EstadoDeLista } from "../util/cursor.ts";
import { criarVigencia } from "../util/vigencia.ts";

export const MAXIMO_DE_ITENS_RENDERIZADOS = 300;

export type PaginaDeCursor<T, E = never> = { dados: T[]; proximo: string | null; total: number; extra?: E };

export type ListaComCursor<T> = {
  itens: T[];
  total: number | null;
  ocultos: number;
  carregando: boolean;
  erro: string | null;
  haMais: boolean;
  carregarMais: () => void;
  recarregar: () => void;
};

export function useListaComCursor<T, E = never>(
  carregar: (cursor: string | undefined, sinal: AbortSignal) => Promise<PaginaDeCursor<T, E>>,
  chave: string,
  ativo = true,
  aoCarregarPagina?: (pagina: PaginaDeCursor<T, E>, primeira: boolean) => void,
  maximoDeItens = MAXIMO_DE_ITENS_RENDERIZADOS,
): ListaComCursor<T> {
  const [estado, despachar] = useReducer(reduzirLista<T>, undefined, listaInicial<T>);
  const [versao, setVersao] = useState(0);
  const funcao = useRef(carregar);
  funcao.current = carregar;
  const aoPagina = useRef(aoCarregarPagina);
  aoPagina.current = aoCarregarPagina;
  const vigencia = useRef(criarVigencia());
  const atual = useRef<EstadoDeLista<T>>(estado);
  atual.current = estado;

  const buscar = useCallback((chaveDoPedido: string, cursor: string | undefined) => {
    const pedido = vigencia.current.iniciar();
    funcao.current(cursor, pedido.sinal).then(
      (pagina) => {
        if (!pedido.vigente()) return;
        despachar({ tipo: "sucesso", chave: chaveDoPedido, dados: pagina.dados, proximo: pagina.proximo, total: pagina.total, anexar: cursor !== undefined, maximo: maximoDeItens });
        aoPagina.current?.(pagina, cursor === undefined);
      },
      (falha: unknown) => {
        if (!pedido.vigente()) return;
        if (falha instanceof ErroDeRede && falha.motivo === "CANCELADO") return;
        despachar({ tipo: "falha", chave: chaveDoPedido, mensagem: mensagemDoErro(falha) });
      },
    );
  }, []);

  useEffect(() => {
    if (!ativo) return;
    const identificador = `${chave}#${versao}`;
    despachar({ tipo: "iniciar", chave: identificador });
    buscar(identificador, undefined);
    const vigenciaAtual = vigencia.current;
    return () => vigenciaAtual.invalidar();
  }, [chave, versao, ativo, buscar]);

  const carregarMais = useCallback(() => {
    const corrente = atual.current;
    if (corrente.carregando || corrente.proximo === null) return;
    despachar({ tipo: "carregarMais", chave: corrente.chave });
    buscar(corrente.chave, corrente.proximo);
  }, [buscar]);

  const recarregar = useCallback(() => setVersao((v) => v + 1), []);

  return { itens: estado.itens, total: estado.total, ocultos: estado.ocultos, carregando: estado.carregando, erro: estado.erro, haMais: estado.proximo !== null, carregarMais, recarregar };
}
