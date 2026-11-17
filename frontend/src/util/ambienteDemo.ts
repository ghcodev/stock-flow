import { montarModoDemo, type ModoDemo } from "./modoDemo.ts";

export const MODO_DEMO: ModoDemo | null =
  import.meta.env.VITE_MODO_DEMO === "true" && !import.meta.env.DEV
    ? montarModoDemo({
        adminEmail: import.meta.env.VITE_DEMO_ADMIN_EMAIL,
        adminSenha: import.meta.env.VITE_DEMO_ADMIN_SENHA,
        operadorEmail: import.meta.env.VITE_DEMO_OPERADOR_EMAIL,
        operadorSenha: import.meta.env.VITE_DEMO_OPERADOR_SENHA,
      })
    : null;
