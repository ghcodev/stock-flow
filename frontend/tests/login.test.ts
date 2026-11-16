import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { ErroDaApi, ErroDeRede } from "../src/api/erros.ts";
import {
  MENSAGEM_DE_CREDENCIAIS_INVALIDAS,
  destinoAposLogin,
  iniciais,
  interpretarFalhaDoLogin,
  temErros,
  validarCredenciais,
} from "../src/autenticacao/credenciais.ts";
import { alternarTema, gravarTema, lerTemaSalvo, resolverTema, valorDoAtributo } from "../src/tema/tema.ts";

describe("validação do formulário de login", () => {
  it("aceita e-mail e senha válidos", () => {
    assert.deepEqual(validarCredenciais("  pessoa@exemplo.com ", "qualquer-senha"), {});
    assert.equal(temErros({}), false);
  });

  it("recusa e-mail vazio, sem arroba, sem domínio com ponto e acima de 160 caracteres", () => {
    for (const email of ["", "   ", "semarroba", "a@b", "a b@c.com", `${"a".repeat(150)}@exemplo.com`]) {
      assert.notEqual(validarCredenciais(email, "x").email, undefined, email);
    }
  });

  it("recusa senha vazia, com NUL e acima de 72 bytes (contados em UTF-8)", () => {
    assert.equal(validarCredenciais("a@b.co", "").senha, "Informe a senha.");
    assert.notEqual(validarCredenciais("a@b.co", "ab\0c").senha, undefined);
    assert.equal(validarCredenciais("a@b.co", "a".repeat(72)).senha, undefined);
    assert.notEqual(validarCredenciais("a@b.co", "a".repeat(73)).senha, undefined);
    assert.notEqual(validarCredenciais("a@b.co", "ç".repeat(37)).senha, undefined);
    assert.equal(validarCredenciais("a@b.co", "ç".repeat(36)).senha, undefined);
  });

  it("não altera a senha digitada: espaços nas pontas contam", () => {
    assert.equal(validarCredenciais("a@b.co", "   ").senha, undefined);
  });
});

describe("mensagens de falha do login", () => {
  it("401 usa sempre a mensagem fixa, sem dizer se o e-mail existe", () => {
    for (const mensagemDaApi of ["E-mail ou senha inválidos", "Usuário inativo", "Usuário não encontrado"]) {
      const falha = interpretarFalhaDoLogin(new ErroDaApi(401, "CREDENCIAIS_INVALIDAS", mensagemDaApi));
      assert.equal(falha.geral, MENSAGEM_DE_CREDENCIAIS_INVALIDAS);
      assert.deepEqual(falha.campos, {});
    }
  });

  it("429 mostra o tempo de espera em minutos, arredondado para cima", () => {
    assert.match(interpretarFalhaDoLogin(new ErroDaApi(429, "MUITAS_TENTATIVAS", "x", [], 61)).geral ?? "", /2 minutos/);
    assert.match(interpretarFalhaDoLogin(new ErroDaApi(429, "MUITAS_TENTATIVAS", "x", [], 60)).geral ?? "", /1 minuto/);
    assert.match(interpretarFalhaDoLogin(new ErroDaApi(429, "MUITAS_TENTATIVAS", "x", [], null)).geral ?? "", /alguns minutos/);
  });

  it("400 mapeia os campos e ignora campos desconhecidos", () => {
    const falha = interpretarFalhaDoLogin(
      new ErroDaApi(400, "VALIDACAO", "Dados inválidos", [
        { campo: "email", mensagem: "E-mail inválido" },
        { campo: "senha", mensagem: "Senha é obrigatória" },
        { campo: "outro", mensagem: "x" },
      ]),
    );
    assert.deepEqual(falha, { geral: null, campos: { email: "E-mail inválido", senha: "Senha é obrigatória" } });
    assert.equal(interpretarFalhaDoLogin(new ErroDaApi(400, "VALIDACAO", "x", [{ campo: "outro", mensagem: "y" }])).geral, "Verifique os dados informados.");
  });

  it("5xx e rede viram mensagens genéricas, sem detalhe do servidor", () => {
    const servidor = interpretarFalhaDoLogin(new ErroDaApi(500, "ERRO_INTERNO", "TypeError: x is undefined at /app/src"));
    assert.doesNotMatch(servidor.geral ?? "", /TypeError|\/app/);
    assert.match(interpretarFalhaDoLogin(new ErroDeRede("SEM_CONEXAO", "x")).geral ?? "", /Sem conexão/);
    assert.match(interpretarFalhaDoLogin(new ErroDeRede("TEMPO_ESGOTADO", "x")).geral ?? "", /demorou/);
    assert.equal(interpretarFalhaDoLogin(new Error("inesperado")).geral, "Não foi possível entrar agora. Tente novamente.");
  });
});

describe("destino depois do login e nome do avatar", () => {
  it("só aceita caminho interno que não seja a própria tela de login", () => {
    assert.equal(destinoAposLogin("/lotes"), "/lotes");
    assert.equal(destinoAposLogin("/lotes?pagina=2"), "/lotes?pagina=2");
    for (const ruim of [undefined, null, 5, "", "lotes", "//malicioso.com", "/\\malicioso.com", "https://malicioso.com", "/entrar"]) {
      assert.equal(destinoAposLogin(ruim), "/", String(ruim));
    }
  });

  it("iniciais usam a primeira e a última palavra do nome", () => {
    assert.equal(iniciais("Maria Souza Lima"), "ML");
    assert.equal(iniciais("  ana  "), "A");
    assert.equal(iniciais(""), "?");
  });
});

describe("tema claro e escuro", () => {
  it("usa a escolha salva e, sem ela, a preferência do sistema", () => {
    assert.equal(resolverTema("claro", true), "claro");
    assert.equal(resolverTema("escuro", false), "escuro");
    assert.equal(resolverTema(null, true), "escuro");
    assert.equal(resolverTema("lixo", false), "claro");
  });

  it("alterna e mapeia para o atributo data-theme dos tokens", () => {
    assert.equal(alternarTema("claro"), "escuro");
    assert.equal(alternarTema("escuro"), "claro");
    assert.equal(valorDoAtributo("escuro"), "dark");
    assert.equal(valorDoAtributo("claro"), "light");
  });

  it("não explode quando o armazenamento falha", () => {
    const quebrado = {
      getItem: () => {
        throw new Error("bloqueado");
      },
      setItem: () => {
        throw new Error("bloqueado");
      },
    };
    assert.equal(lerTemaSalvo(quebrado), null);
    assert.doesNotThrow(() => gravarTema(quebrado, "escuro"));
  });
});
