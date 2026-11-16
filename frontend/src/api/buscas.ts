import type { Cliente } from "./cliente.ts";
import type { Localizacao, Lote, Pagina, Produto } from "./tipos.ts";
import type { OpcaoDeBusca } from "../componentes/SeletorComBusca.tsx";
import { rotuloDaLocalizacao } from "../paginas/lotes/apresentacao.ts";

const LIMITE_DE_OPCOES = 30;

export async function buscarProdutosParaSeletor(cliente: Cliente, texto: string, sinal: AbortSignal, apenasAtivos = true): Promise<OpcaoDeBusca[]> {
  const resposta = await cliente.get<Pagina<Produto>>(
    "/produtos",
    { busca: texto === "" ? undefined : texto, ativo: apenasAtivos ? true : undefined, limite: LIMITE_DE_OPCOES },
    sinal,
  );
  return resposta.dados.map((produto) => ({ valor: String(produto.id_produto), rotulo: `${produto.nome} (${produto.unidade_medida})` }));
}

export async function buscarLocalizacoesParaSeletor(cliente: Cliente, texto: string, sinal: AbortSignal): Promise<OpcaoDeBusca[]> {
  const resposta = await cliente.get<Pagina<Localizacao>>(
    "/localizacoes",
    { busca: texto === "" ? undefined : texto, limite: LIMITE_DE_OPCOES },
    sinal,
  );
  return resposta.dados.map((localizacao) => ({ valor: String(localizacao.id_localizacao), rotulo: rotuloDaLocalizacao(localizacao) }));
}

export async function buscarLotesParaSeletor(cliente: Cliente, texto: string, sinal: AbortSignal): Promise<{ opcao: OpcaoDeBusca; lote: Lote }[]> {
  const resposta = await cliente.get<Pagina<Lote>>(
    "/lotes",
    { numero_lote: texto === "" ? undefined : texto, limite: LIMITE_DE_OPCOES },
    sinal,
  );
  return resposta.dados.map((lote) => ({
    lote,
    opcao: { valor: String(lote.id_lote), rotulo: `${lote.numero_lote} · ${lote.produto.nome} · ${rotuloDaLocalizacao(lote.localizacao)}` },
  }));
}
