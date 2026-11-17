import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { ErroDaApi } from "../src/api/erros.ts";
import {
  corpoDeContagem,
  divergenciaDaContagem,
  idDeContagemValido,
  interpretarFalhaDeContagem,
  interpretarFalhaDeDecisao,
  preverFinalizacao,
  textoDaDivergencia,
  tomDaDivergencia,
  validarContagem,
} from "../src/util/inventario.ts";
import { interpretarFalhaDeMovimentacao } from "../src/util/movimentacao.ts";
import {
  VALORES_DE_USUARIO_VAZIOS,
  corpoDeCriacao,
  corpoDeEdicao,
  interpretarFalhaDeTrocaDeSenha,
  interpretarFalhaDeUsuario,
  semAlteracao,
  validarSenha,
  validarTrocaDeSenha,
  validarUsuario,
} from "../src/util/usuarios.ts";

describe("senha: mínimo de 8, máximo de 72 bytes, sem NUL", () => {
  it("aceita 8 caracteres e recusa 7", () => {
    assert.equal(validarSenha("12345678"), null);
    assert.notEqual(validarSenha("1234567"), null);
  });

  it("conta bytes UTF-8, não caracteres", () => {
    assert.equal(validarSenha("a".repeat(72)), null);
    assert.notEqual(validarSenha("a".repeat(73)), null);
    assert.equal(validarSenha("é".repeat(36)), null);
    assert.notEqual(validarSenha("é".repeat(37)), null);
  });

  it("conta pontos de código no mínimo (emoji vale um)", () => {
    assert.notEqual(validarSenha("😀".repeat(7)), null);
    assert.equal(validarSenha("😀".repeat(8)), null);
  });

  it("recusa NUL", () => {
    assert.notEqual(validarSenha("abcdefg\u0000h"), null);
  });
});

describe("troca da própria senha", () => {
  it("exige atual, nova válida, diferente da atual e confirmação igual", () => {
    assert.deepEqual(validarTrocaDeSenha("antiga123", "novaSenha1", "novaSenha1"), {});
    assert.ok(validarTrocaDeSenha("", "novaSenha1", "novaSenha1")["senha_atual"]);
    assert.ok(validarTrocaDeSenha("antiga123", "curta", "curta")["nova_senha"]);
    assert.ok(validarTrocaDeSenha("igual1234", "igual1234", "igual1234")["nova_senha"]);
    assert.ok(validarTrocaDeSenha("antiga123", "novaSenha1", "outraSenha")["confirmacao"]);
    assert.ok(validarTrocaDeSenha("antiga123", "novaSenha1", "")["confirmacao"]);
  });

  it("SENHA_ATUAL_INCORRETA vai para o campo e 429 informa a espera", () => {
    const campo = interpretarFalhaDeTrocaDeSenha(new ErroDaApi(422, "SENHA_ATUAL_INCORRETA", "Senha atual incorreta"));
    assert.deepEqual(Object.keys(campo.campos), ["senha_atual"]);
    assert.equal(campo.geral, null);
    const limite = interpretarFalhaDeTrocaDeSenha(new ErroDaApi(429, "MUITAS_TENTATIVAS", "x", [], 42));
    assert.match(limite.geral ?? "", /42 s/);
    assert.equal(limite.segundosParaRepetir, 42);
    const semEspera = interpretarFalhaDeTrocaDeSenha(new ErroDaApi(429, "MUITAS_TENTATIVAS", "x"));
    assert.match(semEspera.geral ?? "", /Aguarde/);
  });
});

describe("formulário de usuário", () => {
  const completo = { nome: " Ana Lima ", email: " ANA@Exemplo.com ", perfil: "operador", senha: "senhaSegura1" };

  it("criação exige tudo; edição aceita senha em branco", () => {
    assert.deepEqual(validarUsuario(completo, true), {});
    assert.deepEqual(Object.keys(validarUsuario(VALORES_DE_USUARIO_VAZIOS, true)).sort(), ["email", "nome", "perfil", "senha"]);
    assert.deepEqual(validarUsuario({ ...completo, senha: "" }, false), {});
    assert.ok(validarUsuario({ ...completo, senha: "curta" }, false)["senha"]);
  });

  it("valida e-mail, perfil, tamanhos e NUL", () => {
    assert.ok(validarUsuario({ ...completo, email: "sem-arroba" }, true)["email"]);
    assert.ok(validarUsuario({ ...completo, email: `${"a".repeat(160)}@x.com` }, true)["email"]);
    assert.ok(validarUsuario({ ...completo, perfil: "root" }, true)["perfil"]);
    assert.ok(validarUsuario({ ...completo, nome: "x".repeat(121) }, true)["nome"]);
    assert.ok(validarUsuario({ ...completo, nome: "a\u0000b" }, true)["nome"]);
  });

  it("corpo de criação normaliza e corpo de edição envia só o que mudou", () => {
    assert.deepEqual(corpoDeCriacao(completo), { nome: "Ana Lima", email: "ana@exemplo.com", perfil: "operador", senha: "senhaSegura1" });
    const original = { nome: "Ana Lima", email: "ana@exemplo.com", perfil: "operador" as const };
    assert.deepEqual(corpoDeEdicao({ nome: "Ana Lima", email: "ANA@exemplo.com", perfil: "operador", senha: "" }, original), {});
    assert.equal(semAlteracao({}), true);
    assert.deepEqual(corpoDeEdicao({ nome: "Ana L.", email: "ana@exemplo.com", perfil: "administrador", senha: "outraSenha1" }, original), {
      nome: "Ana L.",
      perfil: "administrador",
      senha: "outraSenha1",
    });
  });

  it("e-mail duplicado vai para o campo; último administrador e autoinativação ficam como mensagem geral", () => {
    const duplicado = interpretarFalhaDeUsuario(new ErroDaApi(409, "REGISTRO_DUPLICADO", "Registro já existente"));
    assert.deepEqual(Object.keys(duplicado.campos), ["email"]);
    const ultimo = interpretarFalhaDeUsuario(new ErroDaApi(409, "ULTIMO_ADMINISTRADOR", "O sistema não pode ficar sem administrador ativo"));
    assert.equal(ultimo.geral, "O sistema não pode ficar sem administrador ativo");
    const auto = interpretarFalhaDeUsuario(new ErroDaApi(409, "AUTO_INATIVACAO", "O administrador não pode inativar a si mesmo"));
    assert.equal(auto.geral, "O administrador não pode inativar a si mesmo");
  });
});

describe("W5: mensagem neutra no 503", () => {
  it("não afirma que o saldo já foi recarregado, mas pede para recarregar o lote", () => {
    const falha = interpretarFalhaDeMovimentacao(new ErroDaApi(503, "SERVICO_OCUPADO", "x"));
    assert.equal(falha.atualizarLote, true);
    assert.doesNotMatch(falha.geral ?? "", /recarregad/);
  });
});

describe("inventário rotativo (F8b)", () => {
  it("divergência em decimal exato, sem Number", () => {
    assert.equal(divergenciaDaContagem("10.3", "10.1"), "0.2");
    assert.equal(divergenciaDaContagem("0", "5"), "-5");
    assert.equal(divergenciaDaContagem("999999999.999", "999999999.998"), "0.001");
    assert.equal(divergenciaDaContagem("1", "1"), "0");
    assert.equal(tomDaDivergencia("0.001"), "sobra");
    assert.equal(tomDaDivergencia("-0.001"), "falta");
    assert.equal(tomDaDivergencia("0"), "zero");
    assert.equal(textoDaDivergencia("2.5", (v) => v), "+2.5");
    assert.equal(textoDaDivergencia("-2.5", (v) => v), "-2.5");
  });

  it("a divergência é somada ao saldo ATUAL, não ao da contagem", () => {
    assert.deepEqual(preverFinalizacao("12", "-5"), { saldoFinal: "7", problema: null });
    assert.deepEqual(preverFinalizacao("3", "-5"), { saldoFinal: "-2", problema: "negativo" });
    assert.deepEqual(preverFinalizacao("999999999.999", "0.001"), { saldoFinal: "1000000000", problema: "excede" });
  });

  it("contagem: zero permitido, 3 casas, sem negativo, observação limitada", () => {
    assert.deepEqual(validarContagem("0", ""), {});
    assert.deepEqual(validarContagem("12,345", ""), {});
    assert.ok(validarContagem("", "")["quantidade"]);
    assert.ok(validarContagem("1,2345", "")["quantidade"]);
    assert.ok(validarContagem("-1", "")["quantidade"]);
    assert.ok(validarContagem("1", "x".repeat(5001))["observacao"]);
    assert.deepEqual(corpoDeContagem(7, "12,5", "  ok "), { id_lote: 7, quantidade_contada: "12.5", observacao: "ok" });
    assert.deepEqual(corpoDeContagem(7, "0", " "), { id_lote: 7, quantidade_contada: "0" });
  });

  it("falhas: segunda contagem pendente, já finalizada, saldo negativo, excede limite", () => {
    assert.equal(interpretarFalhaDeContagem(new ErroDaApi(409, "CONTAGEM_PENDENTE_EXISTENTE", "O lote já tem uma contagem pendente de finalização")).geral, "O lote já tem uma contagem pendente de finalização");
    const ja = interpretarFalhaDeDecisao(new ErroDaApi(409, "CONTAGEM_JA_FINALIZADA", "x"));
    assert.equal(ja.atualizarLista, true);
    assert.match(interpretarFalhaDeDecisao(new ErroDaApi(409, "SALDO_FINAL_NEGATIVO", "x")).geral, /negativo/);
    assert.match(interpretarFalhaDeDecisao(new ErroDaApi(422, "SALDO_EXCEDE_LIMITE", "x")).geral, /limite/);
    assert.equal(interpretarFalhaDeDecisao(new ErroDaApi(500, "ERRO_DO_SERVIDOR", "x")).incerta, true);
  });

  it("id de contagem só aceita inteiro positivo", () => {
    assert.equal(idDeContagemValido("123"), true);
    for (const ruim of ["", "0", "01", "1/../2", "1%2f", "a", "1".repeat(19)]) assert.equal(idDeContagemValido(ruim), false, ruim);
  });
});

describe("ajuste de estoque (F8c)", () => {
  it("justificativa de 10 a 255 caracteres depois de aparar", async () => {
    const { validarJustificativaDoAjuste } = await import("../src/util/ajuste.ts");
    assert.notEqual(validarJustificativaDoAjuste("         curto    "), null);
    assert.equal(validarJustificativaDoAjuste("  dez chars!  "), null);
    assert.equal(validarJustificativaDoAjuste("x".repeat(255)), null);
    assert.notEqual(validarJustificativaDoAjuste("x".repeat(256)), null);
    assert.notEqual(validarJustificativaDoAjuste("justificativa\u0000ok"), null);
  });

  it("novo saldo: obrigatório, decimal, diferente do atual (comparação exata)", async () => {
    const { validarAjuste } = await import("../src/util/ajuste.ts");
    const lote = { quantidade: "10.5" };
    assert.deepEqual(validarAjuste(lote, "11", "justificativa longa"), {});
    assert.deepEqual(validarAjuste(lote, "0", "justificativa longa"), {});
    assert.ok(validarAjuste(lote, "", "justificativa longa")["novo_saldo"]);
    assert.ok(validarAjuste(lote, "10,500", "justificativa longa")["novo_saldo"]);
    assert.ok(validarAjuste(lote, "1,2345", "justificativa longa")["novo_saldo"]);
    assert.ok(validarAjuste(lote, "-1", "justificativa longa")["novo_saldo"]);
    assert.ok(validarAjuste(lote, "11", "curta")["motivo"]);
  });

  it("envia saldo_exibido exatamente como veio da API e normaliza só o novo saldo", async () => {
    const { corpoDeAjuste } = await import("../src/util/ajuste.ts");
    assert.deepEqual(corpoDeAjuste({ id_lote: 3, quantidade: "10.500" }, "12,5", "  motivo bem longo  "), { id_lote: 3, saldo_exibido: "10.500", novo_saldo: "12.5", motivo: "motivo bem longo" });
  });

  it("SALDO_DESATUALIZADO avisa e manda recarregar sem reenviar; 422 sem alteração vai ao campo; lote bloqueado só avisa", async () => {
    const { interpretarFalhaDeAjuste, avisoDoAjuste } = await import("../src/util/ajuste.ts");
    const desatualizado = interpretarFalhaDeAjuste(new ErroDaApi(409, "SALDO_DESATUALIZADO", "x"));
    assert.equal(desatualizado.atualizarLote, true);
    assert.equal(desatualizado.incerta, false);
    assert.match(desatualizado.geral ?? "", /mudou/);
    assert.deepEqual(Object.keys(interpretarFalhaDeAjuste(new ErroDaApi(422, "AJUSTE_SEM_ALTERACAO", "x")).campos), ["novo_saldo"]);
    assert.match(avisoDoAjuste({ status_lote: "bloqueado" }) ?? "", /bloqueado/);
    assert.match(avisoDoAjuste({ status_lote: "ativo", validade_expirada: true }) ?? "", /validade/);
    assert.equal(avisoDoAjuste({ status_lote: "ativo" }), null);
  });
});

describe("X2: localização da URL resolvida pelo id, sem confiar no rótulo da URL", () => {
  it("só o id vale; id inválido é ignorado", async () => {
    const { idDaLocalizacaoNaUrl, ligacaoParaLotesDaLocalizacao } = await import("../src/util/filtroDeUrl.ts");
    assert.equal(idDaLocalizacaoNaUrl("?id_localizacao=12&rotulo=Z-9-99"), "12");
    for (const ruim of ["", "?id_localizacao=0", "?id_localizacao=abc", "?id_localizacao=1%2F..", "?id_localizacao=99999999999", "?rotulo=A"]) assert.equal(idDaLocalizacaoNaUrl(ruim), null, ruim);
    assert.equal(ligacaoParaLotesDaLocalizacao(5), "/lotes?id_localizacao=5");
  });

  it("rótulo real depois da leitura; 'Localização N' enquanto carrega, em 404 ou se o id não bate", async () => {
    const { rotuloDaLocalizacaoDaUrl } = await import("../src/util/filtroDeUrl.ts");
    const real = { id_localizacao: 12, corredor: "A", nivel: "1", posicao: "02" };
    assert.equal(rotuloDaLocalizacaoDaUrl("12", real), "A-1-02");
    assert.equal(rotuloDaLocalizacaoDaUrl("12", null), "Localização 12");
    assert.equal(rotuloDaLocalizacaoDaUrl("13", real), "Localização 13");
  });
});

describe("mapa do armazém (F9a)", () => {
  const posicao = (corredor: string, nivel: string, p: string, total = 0, lotes = 0) =>
    ({ id_localizacao: 1, corredor, nivel, posicao: p, capacidade: null, descricao: null, total_lotes: total, lotes: Array.from({ length: lotes }, () => ({})) }) as unknown as import("../src/api/mapa.ts").PosicaoDoMapa;

  it("agrupa por corredor e nível mantendo a ordem do servidor", async () => {
    const { agruparPorCorredorENivel } = await import("../src/util/mapa.ts");
    const grupos = agruparPorCorredorENivel([posicao("A", "1", "01"), posicao("A", "1", "02"), posicao("A", "2", "01"), posicao("B", "1", "01")]);
    assert.deepEqual(grupos.map((g) => [g.corredor, g.niveis.map((n) => [n.nivel, n.posicoes.length])]), [["A", [["1", 2], ["2", 1]]], ["B", [["1", 1]]]]);
  });

  it("'ver todos' só quando o total passa do que foi listado (50)", async () => {
    const { haMaisLotesQueOsListados, MAXIMO_DE_LOTES_POR_POSICAO } = await import("../src/util/mapa.ts");
    assert.equal(MAXIMO_DE_LOTES_POR_POSICAO, 50);
    assert.equal(haMaisLotesQueOsListados(posicao("A", "1", "01", 50, 50)), false);
    assert.equal(haMaisLotesQueOsListados(posicao("A", "1", "01", 51, 50)), true);
  });

  it("corredor: vazio vale, até 10 caracteres, sem NUL; capacidade só como texto quando existe", async () => {
    const { validarCorredor, textoDaCapacidade } = await import("../src/util/mapa.ts");
    assert.equal(validarCorredor(""), null);
    assert.equal(validarCorredor(" A "), null);
    assert.notEqual(validarCorredor("12345678901"), null);
    assert.notEqual(validarCorredor("A\u0000"), null);
    assert.equal(textoDaCapacidade(null), null);
    assert.equal(textoDaCapacidade("  "), null);
    assert.equal(textoDaCapacidade("120 caixas"), "120 caixas");
  });
});

describe("X1: finalizar só com leitura atual bem-sucedida e previsão válida", () => {
  it("leitura pendente, com erro, nova tentativa e erro de saldo seguido de nova leitura", async () => {
    const { decidirFinalizacao } = await import("../src/util/inventario.ts");
    assert.deepEqual(decidirFinalizacao({ saldo: null, carregando: true, erro: null }, "-2"), { podeConfirmar: false, motivo: "lendo", saldoFinal: null });
    assert.equal(decidirFinalizacao({ saldo: "10", carregando: true, erro: null }, "-2").podeConfirmar, false);
    assert.equal(decidirFinalizacao({ saldo: null, carregando: false, erro: "Sem conexão" }, "-2").motivo, "falha");
    assert.equal(decidirFinalizacao({ saldo: "10", carregando: false, erro: "Sem conexão" }, "-2").podeConfirmar, false);
    assert.deepEqual(decidirFinalizacao({ saldo: "10", carregando: false, erro: null }, "-2"), { podeConfirmar: true, motivo: null, saldoFinal: "8" });
    assert.deepEqual(decidirFinalizacao({ saldo: "1", carregando: false, erro: null }, "-2"), { podeConfirmar: false, motivo: "negativo", saldoFinal: "-1" });
    assert.equal(decidirFinalizacao({ saldo: "999999999.999", carregando: false, erro: null }, "1").motivo, "excede");
    assert.equal(decidirFinalizacao({ saldo: "5", carregando: false, erro: null }, "-2").podeConfirmar, true);
  });

  it("409 de saldo e 422 de limite mandam reler o lote; os demais não", async () => {
    const { interpretarFalhaDeDecisao } = await import("../src/util/inventario.ts");
    assert.equal(interpretarFalhaDeDecisao(new ErroDaApi(409, "SALDO_FINAL_NEGATIVO", "x")).reler, true);
    assert.equal(interpretarFalhaDeDecisao(new ErroDaApi(422, "SALDO_EXCEDE_LIMITE", "x")).reler, true);
    assert.equal(interpretarFalhaDeDecisao(new ErroDaApi(409, "CONTAGEM_JA_FINALIZADA", "x")).reler, false);
  });
});

describe("Z1/Z2: tela sob demanda distingue falha de carga de erro de renderização", () => {
  const Pagina = () => null;

  it("import rejeitado marca falha de carga e repassa o erro; import bem-sucedido limpa a marca", async () => {
    const { criarTelaSobDemanda } = await import("../src/util/telaSobDemanda.ts");
    let falhar = true;
    const tela = criarTelaSobDemanda(() => (falhar ? Promise.reject(new Error("chunk")) : Promise.resolve({ Pagina })), "Pagina");
    assert.equal(tela.falhouNaCarga(), false);
    await assert.rejects(tela.carregar(), /chunk/);
    assert.equal(tela.falhouNaCarga(), true);
    falhar = false;
    assert.equal((await tela.carregar()).default, Pagina);
    assert.equal(tela.falhouNaCarga(), false);
  });

  it("cada tela tem seu estado: falha de A não marca B; tela já carregada nunca falha na carga", async () => {
    const { criarTelaSobDemanda, telaJaCarregada } = await import("../src/util/telaSobDemanda.ts");
    const a = criarTelaSobDemanda(() => Promise.reject(new Error("a")), "Pagina");
    const b = criarTelaSobDemanda(() => Promise.resolve({ Pagina }), "Pagina");
    await assert.rejects(a.carregar());
    await b.carregar();
    assert.equal(a.falhouNaCarga(), true);
    assert.equal(b.falhouNaCarga(), false);
    assert.equal(telaJaCarregada(Pagina).falhouNaCarga(), false);
  });
});

describe("Y2: leitura do lote (pendente, falhou, válida)", () => {
  const lote = (id: number, quantidade = "10") => ({ id_lote: id, quantidade }) as unknown as import("../src/api/tipos.ts").Lote;

  it("só a leitura válida do lote atual libera a escrita", async () => {
    const { reduzirLeitura, podeEscreverNoLote } = await import("../src/util/leituraDoLote.ts");
    let l = reduzirLeitura(null, { tipo: "escolher", lote: lote(1) });
    assert.equal(podeEscreverNoLote(l), true);
    l = reduzirLeitura(l, { tipo: "reler", id: 1 });
    assert.equal(podeEscreverNoLote(l), false);
    l = reduzirLeitura(l, { tipo: "recebida", lote: lote(1, "7") });
    assert.equal(podeEscreverNoLote(l), true);
    assert.equal(l?.lote.quantidade, "7");
  });

  it("falha da releitura mantém a escrita bloqueada até nova leitura bem-sucedida", async () => {
    const { reduzirLeitura, podeEscreverNoLote } = await import("../src/util/leituraDoLote.ts");
    let l = reduzirLeitura(null, { tipo: "escolher", lote: lote(1) });
    l = reduzirLeitura(l, { tipo: "reler", id: 1 });
    l = reduzirLeitura(l, { tipo: "falhou", id: 1 });
    assert.equal(l?.estado, "falhou");
    assert.equal(podeEscreverNoLote(l), false);
    l = reduzirLeitura(l, { tipo: "reler", id: 1 });
    l = reduzirLeitura(l, { tipo: "recebida", lote: lote(1) });
    assert.equal(podeEscreverNoLote(l), true);
  });

  it("trocar de lote (seletor, leitor ou Trocar) durante a releitura pendente descarta a resposta antiga e libera o novo", async () => {
    const { reduzirLeitura, podeEscreverNoLote } = await import("../src/util/leituraDoLote.ts");
    let l = reduzirLeitura(null, { tipo: "escolher", lote: lote(1) });
    l = reduzirLeitura(l, { tipo: "reler", id: 1 });
    l = reduzirLeitura(l, { tipo: "escolher", lote: lote(2, "5") });
    assert.equal(podeEscreverNoLote(l), true);
    assert.equal(l?.lote.id_lote, 2);
    l = reduzirLeitura(l, { tipo: "recebida", lote: lote(1, "99") });
    assert.equal(l?.lote.id_lote, 2);
    assert.equal(l?.lote.quantidade, "5");
    l = reduzirLeitura(l, { tipo: "falhou", id: 1 });
    assert.equal(l?.estado, "valida");
    l = reduzirLeitura(l, { tipo: "limpar" });
    assert.equal(l, null);
    assert.equal(podeEscreverNoLote(reduzirLeitura(l, { tipo: "recebida", lote: lote(2) })), false);
  });
});

describe("B1: inclinação do parallax", () => {
  it("ponteiro vira -1..1 e limita; tamanho inválido não inclina", async () => {
    const { inclinacaoDoPonteiro } = await import("../src/util/parallax.ts");
    assert.deepEqual(inclinacaoDoPonteiro(0, 0, 100, 200), { x: -1, y: -1 });
    assert.deepEqual(inclinacaoDoPonteiro(50, 100, 100, 200), { x: 0, y: 0 });
    assert.deepEqual(inclinacaoDoPonteiro(500, -50, 100, 200), { x: 1, y: -1 });
    assert.deepEqual(inclinacaoDoPonteiro(10, 10, 0, 0), { x: 0, y: 0 });
  });

  it("aparelho: neutro em beta 45, limita e ignora leituras nulas ou inválidas", async () => {
    const { inclinacaoDoAparelho } = await import("../src/util/parallax.ts");
    assert.deepEqual(inclinacaoDoAparelho(45, 0), { x: 0, y: 0 });
    assert.deepEqual(inclinacaoDoAparelho(200, 90), { x: 1, y: 1 });
    assert.deepEqual(inclinacaoDoAparelho(null, 10), { x: 0, y: 0 });
    assert.deepEqual(inclinacaoDoAparelho(Number.NaN, 10), { x: 0, y: 0 });
  });

  it("suavizar converge ao alvo e para quando estabiliza", async () => {
    const { suavizar, estabilizou } = await import("../src/util/parallax.ts");
    let atual = { x: 0, y: 0 };
    const alvo = { x: 1, y: -1 };
    for (let i = 0; i < 200; i++) atual = suavizar(atual, alvo);
    assert.equal(estabilizou(atual, alvo), true);
    assert.equal(estabilizou({ x: 0, y: 0 }, alvo), false);
  });
});

describe("B2: contador animado", () => {
  it("interpola de 0 ao valor, com saída suave, e respeita os limites", async () => {
    const { valorDoContador, suavizacaoDeSaida } = await import("../src/util/animacao.ts");
    assert.equal(valorDoContador(0, 100, 0), 0);
    assert.equal(valorDoContador(0, 100, 1), 100);
    assert.equal(valorDoContador(0, 100, 2), 100);
    assert.equal(valorDoContador(0, 100, -1), 0);
    assert.ok(valorDoContador(0, 100, 0.5) > 50);
    assert.equal(valorDoContador(40, 10, 1), 10);
    assert.ok(suavizacaoDeSaida(0.2) > 0.2);
  });
});
