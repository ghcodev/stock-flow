import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { montarModoDemo } from "../src/util/modoDemo.ts";

const completo = { adminEmail: "admin@exemplo.test", adminSenha: "senha-a", operadorEmail: "operador@exemplo.test", operadorSenha: "senha-o" };

describe("modo demonstração", () => {
  it("monta as duas credenciais quando as quatro valores existem", () => {
    const modo = montarModoDemo(completo);
    assert.equal(modo?.administrador.email, "admin@exemplo.test");
    assert.equal(modo?.operador.senha, "senha-o");
  });

  it("fica desligado se faltar qualquer valor ou se não for texto", () => {
    assert.equal(montarModoDemo({ ...completo, adminSenha: "" }), null);
    assert.equal(montarModoDemo({ ...completo, operadorEmail: "  " }), null);
    assert.equal(montarModoDemo({ ...completo, adminEmail: 1 }), null);
    assert.equal(montarModoDemo({ ...completo, operadorSenha: undefined }), null);
  });
});
