import { segmento, type Cliente } from "./cliente.ts";
import type { Pagina, Produto } from "./tipos.ts";
import { normalizarDecimal, type ValoresDeProduto } from "../util/formularios.ts";

export type FiltroDeProdutos = {
  busca?: string | undefined;
  ativo?: boolean | undefined;
  pagina?: number | undefined;
  limite?: number | undefined;
};

export type CorpoDeProduto = {
  nome: string;
  categoria?: string | null;
  descricao?: string | null;
  unidade_medida: string;
  estoque_minimo?: string;
};

export function corpoDeProduto(valores: ValoresDeProduto, modo: "criar" | "editar"): CorpoDeProduto {
  const categoria = valores.categoria.trim();
  const descricao = valores.descricao.trim();
  const minimo = valores.estoque_minimo.trim();
  const corpo: CorpoDeProduto = { nome: valores.nome.trim(), unidade_medida: valores.unidade_medida.trim() };
  if (modo === "criar") {
    if (categoria !== "") corpo.categoria = categoria;
    if (descricao !== "") corpo.descricao = descricao;
    if (minimo !== "") corpo.estoque_minimo = normalizarDecimal(minimo);
    return corpo;
  }
  corpo.categoria = categoria === "" ? null : categoria;
  corpo.descricao = descricao === "" ? null : descricao;
  corpo.estoque_minimo = minimo === "" ? "0" : normalizarDecimal(minimo);
  return corpo;
}

export function listarProdutos(cliente: Cliente, filtro: FiltroDeProdutos, sinal?: AbortSignal): Promise<Pagina<Produto>> {
  return cliente.get<Pagina<Produto>>(
    "/produtos",
    { busca: filtro.busca, ativo: filtro.ativo, pagina: filtro.pagina, limite: filtro.limite },
    sinal,
  );
}

export function criarProduto(cliente: Cliente, corpo: CorpoDeProduto): Promise<Produto> {
  return cliente.post<Produto>("/produtos", corpo);
}

export function atualizarProduto(cliente: Cliente, id: number, corpo: CorpoDeProduto): Promise<Produto> {
  return cliente.patch<Produto>(`/produtos/${segmento(id)}`, corpo);
}

export function inativarProduto(cliente: Cliente, id: number): Promise<Produto> {
  return cliente.post<Produto>(`/produtos/${segmento(id)}/inativar`);
}
