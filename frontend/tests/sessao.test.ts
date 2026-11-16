import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  CHAVE_DA_SESSAO,
  carregarSessao,
  expiracaoDoToken,
  limparSessao,
  salvarSessao,
  tokenVigente,
  type Armazenamento,
  type Sessao,
} from "../src/sessao/sessao.ts";
import { decidirAcesso, podeAcessar, podeExecutar, type Recurso } from "../src/sessao/permissoes.ts";
import { recursoDoCaminho } from "../src/sessao/rotas.ts";
import { ITENS_DE_MENU, itemDoCaminho, menuDoPerfil } from "../src/sessao/navegacao.ts";

const base64url = (texto: string): string => Buffer.from(texto, "utf8").toString("base64url");
const tokenCom = (carga: Record<string, unknown>): string => `${base64url('{"alg":"HS256"}')}.${base64url(JSON.stringify(carga))}.assinatura`;

function memoria(): Armazenamento & { dados: Map<string, string> } {
  const dados = new Map<string, string>();
  return {
    dados,
    getItem: (chave) => dados.get(chave) ?? null,
    setItem: (chave, valor) => void dados.set(chave, valor),
    removeItem: (chave) => void dados.delete(chave),
  };
}

const AGORA = Date.parse("2026-11-16T12:00:00Z");
const EM_8_HORAS = Math.floor(AGORA / 1000) + 8 * 3600;

const sessaoDe = (perfil: "administrador" | "operador", exp = EM_8_HORAS): Sessao => ({
  token: tokenCom({ sub: "7", exp, iat: exp - 8 * 3600 }),
  usuario: { id_usuario: 7, nome: "Fulana", email: "fulana@exemplo.com", perfil },
});

describe("expiração do token lida do payload", () => {
  it("lê exp em segundos e devolve milissegundos", () => {
    assert.equal(expiracaoDoToken(tokenCom({ exp: 1_800_000_000 })), 1_800_000_000_000);
  });

  it("aceita payload com acentos em UTF-8 e base64url com - e _", () => {
    assert.equal(expiracaoDoToken(tokenCom({ nome: "Pão ção ??>>", exp: 1_800_000_000 })), 1_800_000_000_000);
  });

  it("recusa token malformado, sem exp ou com exp que não é número", () => {
    for (const token of ["", "a.b", "a.b.c.d", "a.%%%.c", tokenCom({}), tokenCom({ exp: "amanhã" }), tokenCom({ exp: null })]) {
      assert.equal(expiracaoDoToken(token), null, token);
    }
  });

  it("vigente só antes do exp", () => {
    const token = tokenCom({ exp: 1_800_000_000 });
    assert.equal(tokenVigente(token, 1_799_999_999_000), true);
    assert.equal(tokenVigente(token, 1_800_000_000_000), false);
    assert.equal(tokenVigente("lixo", 0), false);
  });
});

describe("sessão em armazenamento de aba", () => {
  it("salva e recarrega a sessão vigente", () => {
    const arm = memoria();
    const sessao = sessaoDe("operador");
    salvarSessao(arm, sessao);
    assert.deepEqual(carregarSessao(arm, AGORA), sessao);
  });

  it("descarta e apaga sessão expirada, corrompida ou com perfil desconhecido", () => {
    const expirada = memoria();
    salvarSessao(expirada, sessaoDe("operador", Math.floor(AGORA / 1000) - 1));
    assert.equal(carregarSessao(expirada, AGORA), null);
    assert.equal(expirada.dados.has(CHAVE_DA_SESSAO), false);

    const corrompida = memoria();
    corrompida.setItem(CHAVE_DA_SESSAO, "{nao e json");
    assert.equal(carregarSessao(corrompida, AGORA), null);
    assert.equal(corrompida.dados.has(CHAVE_DA_SESSAO), false);

    const estranha = memoria();
    estranha.setItem(CHAVE_DA_SESSAO, JSON.stringify({ ...sessaoDe("operador"), usuario: { id_usuario: 1, nome: "x", email: "y", perfil: "root" } }));
    assert.equal(carregarSessao(estranha, AGORA), null);
    assert.equal(estranha.dados.has(CHAVE_DA_SESSAO), false);
  });

  it("sair limpa tudo e não explode quando o armazenamento falha", () => {
    const arm = memoria();
    salvarSessao(arm, sessaoDe("administrador"));
    limparSessao(arm);
    assert.equal(arm.dados.size, 0);
    const quebrado: Armazenamento = {
      getItem: () => {
        throw new Error("bloqueado");
      },
      setItem: () => {
        throw new Error("bloqueado");
      },
      removeItem: () => {
        throw new Error("bloqueado");
      },
    };
    assert.equal(carregarSessao(quebrado, AGORA), null);
    assert.doesNotThrow(() => salvarSessao(quebrado, sessaoDe("operador")));
    assert.doesNotThrow(() => limparSessao(quebrado));
  });
});

describe("permissões por perfil (seção 17.2; o backend é a autoridade)", () => {
  const SOMENTE_ADMIN: Recurso[] = ["usuarios", "auditoria", "ajuste"];

  it("operador não acessa usuários, auditoria nem ajuste; acessa o resto", () => {
    for (const item of ITENS_DE_MENU) {
      assert.equal(podeAcessar("operador", item.recurso), !SOMENTE_ADMIN.includes(item.recurso), item.recurso);
    }
  });

  it("administrador acessa tudo", () => {
    for (const item of ITENS_DE_MENU) assert.equal(podeAcessar("administrador", item.recurso), true, item.recurso);
  });

  it("sem perfil não acessa nada e nenhuma ação é permitida", () => {
    for (const item of ITENS_DE_MENU) assert.equal(podeAcessar(null, item.recurso), false);
    assert.equal(podeExecutar(null, "exportar_vencimentos"), false);
  });

  it("finalizar e cancelar contagem e exportar vencimentos só para administrador", () => {
    for (const acao of ["finalizar_contagem", "cancelar_contagem", "exportar_vencimentos"] as const) {
      assert.equal(podeExecutar("operador", acao), false, acao);
      assert.equal(podeExecutar("administrador", acao), true, acao);
    }
  });

  it("decisão de acesso: login sem sessão, negado sem permissão, permitido caso contrário", () => {
    assert.equal(decidirAcesso(null, undefined), "login");
    assert.equal(decidirAcesso(null, "dashboard"), "login");
    assert.equal(decidirAcesso("operador", "auditoria"), "negado");
    assert.equal(decidirAcesso("operador", "lotes"), "permitido");
    assert.equal(decidirAcesso("operador", undefined), "negado");
    assert.equal(decidirAcesso("administrador", undefined), "negado");
    assert.equal(decidirAcesso("administrador", "usuarios"), "permitido");
  });
});

describe("menu por perfil", () => {
  const rotulos = (perfil: "administrador" | "operador" | null): string[] =>
    menuDoPerfil(perfil).flatMap((g) => g.itens.map((i) => i.rotulo));

  it("operador não vê Usuários, Auditoria nem Ajuste e não tem o grupo Administração", () => {
    const grupos = menuDoPerfil("operador").map((g) => g.rotulo);
    assert.deepEqual(grupos, ["Operação", "Movimentações", "Análise", "Conta"]);
    for (const proibido of ["Usuários", "Auditoria", "Ajuste de estoque"]) assert.ok(!rotulos("operador").includes(proibido), proibido);
  });

  it("administrador vê todos os itens, na ordem dos grupos", () => {
    assert.equal(rotulos("administrador").length, ITENS_DE_MENU.length);
    assert.deepEqual(menuDoPerfil("administrador").map((g) => g.rotulo), ["Operação", "Movimentações", "Análise", "Administração", "Conta"]);
  });

  it("sem sessão o menu é vazio e os caminhos são únicos", () => {
    assert.deepEqual(menuDoPerfil(null), []);
    assert.equal(new Set(ITENS_DE_MENU.map((i) => i.caminho)).size, ITENS_DE_MENU.length);
    assert.equal(new Set(ITENS_DE_MENU.map((i) => i.recurso)).size, ITENS_DE_MENU.length);
  });

  it("resolve o item pelo caminho, ignorando barra final", () => {
    assert.equal(itemDoCaminho("/")?.recurso, "dashboard");
    assert.equal(itemDoCaminho("/lotes/")?.recurso, "lotes");
    assert.equal(itemDoCaminho("/nao-existe"), undefined);
  });
});

describe("recurso associado à rota, com caixa e barras (R3)", () => {
  it("caminhos exatos resolvem o recurso declarado", () => {
    for (const item of ITENS_DE_MENU) assert.equal(recursoDoCaminho(item.caminho), item.recurso, item.caminho);
  });

  it("variações de caixa não casam com nenhum recurso", () => {
    for (const caminho of ["/USUARIOS", "/Usuarios", "/AUDITORIA", "/Auditoria", "/AJUSTE", "/aJuste", "/LOTES", "/Produtos"]) {
      assert.equal(recursoDoCaminho(caminho), undefined, caminho);
    }
  });

  it("barra final é aceita, barras duplas, subcaminhos e pontos não", () => {
    assert.equal(recursoDoCaminho("/usuarios/"), "usuarios");
    assert.equal(recursoDoCaminho("/usuarios//"), "usuarios");
    for (const caminho of ["//usuarios", "/usuarios/1", "/usuarios/../auditoria", "/./usuarios", "/usuarios%2F", "usuarios", "/inexistente"]) {
      assert.equal(recursoDoCaminho(caminho), undefined, caminho);
    }
  });

  it("operador é negado em toda variação de rota administrativa e administrador só nas exatas", () => {
    for (const caminho of ["/USUARIOS", "/Auditoria", "/AJUSTE", "/usuarios", "/auditoria", "/ajuste"]) {
      assert.equal(decidirAcesso("operador", recursoDoCaminho(caminho)), "negado", caminho);
    }
    assert.equal(decidirAcesso("administrador", recursoDoCaminho("/usuarios")), "permitido");
    assert.equal(decidirAcesso("administrador", recursoDoCaminho("/USUARIOS")), "negado");
  });
});
