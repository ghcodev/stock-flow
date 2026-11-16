import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { criarCliente, lerSegundosParaRepetir, montarConsulta, type DependenciasDoCliente } from "../src/api/cliente.ts";
import { ErroDaApi, ErroDeRede, mensagemDoErro } from "../src/api/erros.ts";
import { entrar } from "../src/api/autenticacao.ts";

type Chamada = { url: string; init: RequestInit };

function simular(resposta: () => Response | Promise<Response>, extras: Partial<DependenciasDoCliente> = {}) {
  const chamadas: Chamada[] = [];
  let naoAutorizado = 0;
  const buscar = ((url: string, init: RequestInit) => {
    chamadas.push({ url, init });
    return Promise.resolve(resposta());
  }) as unknown as typeof fetch;
  const cliente = criarCliente({
    buscar,
    obterToken: () => null,
    aoNaoAutorizado: () => {
      naoAutorizado += 1;
    },
    ...extras,
  });
  return { cliente, chamadas, naoAutorizado: () => naoAutorizado };
}

const json = (corpo: unknown, status = 200, cabecalhos: Record<string, string> = {}) =>
  new Response(JSON.stringify(corpo), { status, headers: { "Content-Type": "application/json", ...cabecalhos } });

const cabecalho = (chamada: Chamada | undefined, nome: string): string | undefined =>
  (chamada?.init.headers as Record<string, string> | undefined)?.[nome];

describe("cliente da API", () => {
  it("envia Authorization Bearer só quando há token e usa o prefixo /api", async () => {
    const com = simular(() => json({ ok: true }), { obterToken: () => "abc.def.ghi" });
    await com.cliente.get("/produtos");
    assert.equal(com.chamadas[0]?.url, "/api/produtos");
    assert.equal(cabecalho(com.chamadas[0], "Authorization"), "Bearer abc.def.ghi");
    const sem = simular(() => json({ ok: true }));
    await sem.cliente.get("/health");
    assert.equal(cabecalho(sem.chamadas[0], "Authorization"), undefined);
  });

  it("serializa o corpo em JSON com Content-Type e não envia corpo no GET", async () => {
    const t = simular(() => json({ token: "x", usuario: {} }));
    await entrar(t.cliente, "a@b.co", "segredo-123");
    assert.equal(t.chamadas[0]?.init.method, "POST");
    assert.equal(cabecalho(t.chamadas[0], "Content-Type"), "application/json");
    assert.deepEqual(JSON.parse(String(t.chamadas[0]?.init.body)), { email: "a@b.co", senha: "segredo-123" });
    await t.cliente.get("/lotes");
    assert.equal(t.chamadas[1]?.init.body, null);
    assert.equal(cabecalho(t.chamadas[1], "Content-Type"), undefined);
  });

  it("monta a consulta ignorando vazios, nulos e indefinidos e codificando o resto", () => {
    assert.equal(montarConsulta(undefined), "");
    assert.equal(montarConsulta({ a: undefined, b: null, c: "", d: 0, e: false }), "?d=0&e=false");
    assert.equal(montarConsulta({ q: "a b&c=d%", pagina: 2 }), "?q=a+b%26c%3Dd%25&pagina=2");
  });

  it("devolve o erro padrão com código, mensagem e campos", async () => {
    const corpo = {
      erro: { codigo: "VALIDACAO", mensagem: "Dados inválidos", campos: [{ campo: "email", mensagem: "E-mail inválido" }, { x: 1 }] },
    };
    const t = simular(() => json(corpo, 400));
    await assert.rejects(t.cliente.post("/auth/login", {}), (erro: unknown) => {
      assert.ok(erro instanceof ErroDaApi);
      assert.equal(erro.status, 400);
      assert.equal(erro.codigo, "VALIDACAO");
      assert.deepEqual(erro.campos, [{ campo: "email", mensagem: "E-mail inválido" }]);
      return true;
    });
  });

  it("401 com token limpa a sessão uma vez; 401 sem token (login) não", async () => {
    const com = simular(() => json({ erro: { codigo: "NAO_AUTORIZADO", mensagem: "Sessão inválida" } }, 401), {
      obterToken: () => "t",
    });
    await assert.rejects(com.cliente.get("/dashboard"), (e: unknown) => e instanceof ErroDaApi && e.status === 401);
    assert.equal(com.naoAutorizado(), 1);
    const sem = simular(() => json({ erro: { codigo: "CREDENCIAIS_INVALIDAS", mensagem: "x" } }, 401));
    await assert.rejects(entrar(sem.cliente, "a@b.co", "senha-qualquer"), (e: unknown) => e instanceof ErroDaApi && e.status === 401);
    assert.equal(sem.naoAutorizado(), 0);
  });

  it("429 traz os segundos de Retry-After, em número ou em data HTTP", async () => {
    const numero = simular(() => json({ erro: { codigo: "MUITAS_TENTATIVAS", mensagem: "x" } }, 429, { "Retry-After": "120" }));
    await assert.rejects(numero.cliente.post("/auth/login", {}), (e: unknown) => e instanceof ErroDaApi && e.segundosParaRepetir === 120);
    const agora = Date.parse("2026-11-16T12:00:00Z");
    assert.equal(lerSegundosParaRepetir("Mon, 16 Nov 2026 12:01:30 GMT", agora), 90);
    assert.equal(lerSegundosParaRepetir("Mon, 16 Nov 2026 11:00:00 GMT", agora), 0);
    assert.equal(lerSegundosParaRepetir("lixo", agora), null);
    assert.equal(lerSegundosParaRepetir(null, agora), null);
    assert.match(mensagemDoErro(new ErroDaApi(429, "MUITAS_TENTATIVAS", "qualquer")), /Muitas tentativas/);
  });

  it("resposta de erro que não é JSON não vaza o corpo e vira erro genérico", async () => {
    const t = simular(() => new Response("<html>stack trace secreto</html>", { status: 502 }));
    await assert.rejects(t.cliente.get("/x"), (erro: unknown) => {
      assert.ok(erro instanceof ErroDaApi);
      assert.equal(erro.codigo, "ERRO_DO_SERVIDOR");
      assert.doesNotMatch(erro.message + mensagemDoErro(erro), /stack|secreto|html/i);
      return true;
    });
  });

  it("204 devolve undefined e sucesso com corpo inválido é erro", async () => {
    const semCorpo = simular(() => new Response(null, { status: 204 }));
    assert.equal(await semCorpo.cliente.post("/auth/senha", {}), undefined);
    const quebrado = simular(() => new Response("não é json", { status: 200 }));
    await assert.rejects(quebrado.cliente.get("/x"), (e: unknown) => e instanceof ErroDaApi && e.codigo === "RESPOSTA_INVALIDA");
  });

  it("falha de rede não é engolida: vira ErroDeRede SEM_CONEXAO", async () => {
    const cliente = criarCliente({
      buscar: (() => Promise.reject(new TypeError("fetch failed"))) as unknown as typeof fetch,
      obterToken: () => null,
      aoNaoAutorizado: () => undefined,
    });
    await assert.rejects(cliente.get("/x"), (erro: unknown) => {
      assert.ok(erro instanceof ErroDeRede);
      assert.equal(erro.motivo, "SEM_CONEXAO");
      assert.match(mensagemDoErro(erro), /Sem conexão/);
      return true;
    });
  });

  it("tempo limite aborta a requisição e vira TEMPO_ESGOTADO", async () => {
    const pendente = ((_url: string, init: RequestInit) =>
      new Promise<Response>((_resolver, rejeitar) => {
        init.signal?.addEventListener("abort", () => rejeitar(new DOMException("abortado", "AbortError")));
      })) as unknown as typeof fetch;
    const cliente = criarCliente({ buscar: pendente, obterToken: () => null, aoNaoAutorizado: () => undefined, tempoLimiteMs: 20 });
    await assert.rejects(cliente.get("/x"), (e: unknown) => e instanceof ErroDeRede && e.motivo === "TEMPO_ESGOTADO");
  });

  it("cancelamento pelo chamador vira CANCELADO, inclusive quando o sinal já estava abortado", async () => {
    const pendente = ((_url: string, init: RequestInit) =>
      new Promise<Response>((_resolver, rejeitar) => {
        if (init.signal?.aborted) rejeitar(new DOMException("abortado", "AbortError"));
        init.signal?.addEventListener("abort", () => rejeitar(new DOMException("abortado", "AbortError")));
      })) as unknown as typeof fetch;
    const cliente = criarCliente({ buscar: pendente, obterToken: () => null, aoNaoAutorizado: () => undefined });
    const controle = new AbortController();
    const espera = cliente.get("/x", undefined, controle.signal);
    controle.abort();
    await assert.rejects(espera, (e: unknown) => e instanceof ErroDeRede && e.motivo === "CANCELADO");
    await assert.rejects(cliente.get("/x", undefined, controle.signal), (e: unknown) => e instanceof ErroDeRede && e.motivo === "CANCELADO");
  });
});
