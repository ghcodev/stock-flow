import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { criarVigencia } from "../src/util/vigencia.ts";

function resposta<T>() {
  let resolver: (valor: T) => void = () => undefined;
  const promessa = new Promise<T>((r) => {
    resolver = r;
  });
  return { promessa, resolver };
}

describe("vigência de pedidos: só o último altera a tela (T3)", () => {
  it("duas leituras com respostas invertidas terminam no lote da segunda", async () => {
    const vigencia = criarVigencia();
    let painel: string | null = null;
    const a = resposta<string>();
    const b = resposta<string>();
    const buscar = async (r: { promessa: Promise<string> }) => {
      const pedido = vigencia.iniciar();
      const lote = await r.promessa;
      if (pedido.vigente()) painel = lote;
    };
    const execA = buscar(a);
    const execB = buscar(b);
    b.resolver("lote-B");
    await execB;
    a.resolver("lote-A");
    await execA;
    assert.equal(painel, "lote-B");
  });

  it("o pedido anterior é abortado ao iniciar outro", () => {
    const vigencia = criarVigencia();
    const primeiro = vigencia.iniciar();
    const segundo = vigencia.iniciar();
    assert.equal(primeiro.sinal.aborted, true);
    assert.equal(primeiro.vigente(), false);
    assert.equal(segundo.vigente(), true);
  });

  it("fechar o painel antes do resultado impede a reabertura tardia", async () => {
    const vigencia = criarVigencia();
    let painel: string | null = null;
    const r = resposta<string>();
    const pedido = vigencia.iniciar();
    const execucao = r.promessa.then((lote) => {
      if (pedido.vigente()) painel = lote;
    });
    vigencia.invalidar();
    r.resolver("lote-tardio");
    await execucao;
    assert.equal(painel, null);
    assert.equal(pedido.sinal.aborted, true);
  });

  it("ação posterior (aposAcao) invalida a busca anterior e vice-versa; invalidar sem pedido não falha", async () => {
    const vigencia = criarVigencia();
    vigencia.invalidar();
    const busca = vigencia.iniciar();
    const acao = vigencia.iniciar();
    assert.equal(busca.vigente(), false);
    assert.equal(acao.vigente(), true);
    vigencia.invalidar();
    assert.equal(acao.vigente(), false);
  });
});
