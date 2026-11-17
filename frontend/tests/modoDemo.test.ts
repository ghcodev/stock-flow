import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { lerModoDemo } from "../src/util/modoDemo.ts";

const completo = {
  VITE_MODO_DEMO: "true",
  VITE_DEMO_ADMIN_EMAIL: "admin@exemplo.test",
  VITE_DEMO_ADMIN_SENHA: "senha-a",
  VITE_DEMO_OPERADOR_EMAIL: "operador@exemplo.test",
  VITE_DEMO_OPERADOR_SENHA: "senha-o",
};

describe("modo demonstração", () => {
  it("fica desligado sem a variável ou com outro valor", () => {
    assert.equal(lerModoDemo({}), null);
    assert.equal(lerModoDemo({ ...completo, VITE_MODO_DEMO: "false" }), null);
    assert.equal(lerModoDemo({ ...completo, VITE_MODO_DEMO: undefined }), null);
  });

  it("liga só com as quatro credenciais preenchidas", () => {
    const modo = lerModoDemo(completo);
    assert.equal(modo?.administrador.email, "admin@exemplo.test");
    assert.equal(modo?.operador.senha, "senha-o");
    assert.equal(lerModoDemo({ ...completo, VITE_DEMO_ADMIN_SENHA: "" }), null);
    assert.equal(lerModoDemo({ ...completo, VITE_DEMO_OPERADOR_EMAIL: "  " }), null);
    assert.equal(lerModoDemo({ ...completo, VITE_DEMO_ADMIN_EMAIL: 1 }), null);
  });
});
