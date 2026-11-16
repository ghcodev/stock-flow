import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./estilos/tokens.css";
import "./estilos/base.css";
import { App } from "./App.tsx";
import { iniciarCaptura } from "./leitor/captura.ts";
import { aplicarTemaInicial } from "./tema/useTema.ts";

iniciarCaptura();
aplicarTemaInicial();

const raiz = document.getElementById("raiz");
if (raiz) {
  createRoot(raiz).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}
