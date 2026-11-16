import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { criarCliente } from "../src/api/cliente.ts";
import { buscarLocalizacoesParaSeletor } from "../src/api/buscas.ts";

describe("busca de localização usa o texto inteiro no servidor (U2)", () => {
  it("envia o rótulo digitado em busca, sem contornos no cliente, com o limite do seletor", async () => {
    const urls: string[] = [];
    const cliente = criarCliente({
      buscar: ((url: string) => {
        urls.push(url);
        return Promise.resolve(new Response(JSON.stringify({ dados: [{ id_localizacao: 4, corredor: "A", nivel: "1", posicao: "01", capacidade: null, descricao: null }], pagina: 1, limite: 30, total: 1 }), { headers: { "Content-Type": "application/json" } }));
      }) as unknown as typeof fetch,
      obterToken: () => "t",
      aoNaoAutorizado: () => undefined,
    });
    const opcoes = await buscarLocalizacoesParaSeletor(cliente, "A-1-01", new AbortController().signal);
    assert.deepEqual(opcoes, [{ valor: "4", rotulo: "A-1-01" }]);
    assert.equal(urls[0], "/api/localizacoes?busca=A-1-01&limite=30");
    await buscarLocalizacoesParaSeletor(cliente, "", new AbortController().signal);
    assert.equal(urls[1], "/api/localizacoes?limite=30");
  });
});
