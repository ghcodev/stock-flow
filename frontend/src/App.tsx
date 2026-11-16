import type { ComponentType } from "react";
import { BrowserRouter, Route, Routes } from "react-router";
import { ProvedorDeAutenticacao } from "./autenticacao/ContextoDeAutenticacao.tsx";
import { ExigeSessao, Protegida } from "./autenticacao/RotaProtegida.tsx";
import { ProvedorDeAvisos } from "./componentes/Avisos.tsx";
import { Layout } from "./componentes/Layout.tsx";
import { ITENS_DE_MENU } from "./sessao/navegacao.ts";
import type { Recurso } from "./sessao/permissoes.ts";
import { EmBreve } from "./paginas/EmBreve.tsx";
import { Entrar } from "./paginas/Entrar.tsx";
import { NaoEncontrada } from "./paginas/NaoEncontrada.tsx";

const PAGINAS: Partial<Record<Recurso, ComponentType>> = {};

export function App() {
  return (
    <BrowserRouter>
      <ProvedorDeAutenticacao>
        <ProvedorDeAvisos>
        <Routes>
          <Route path="/entrar" element={<Entrar />} caseSensitive />
          <Route element={<ExigeSessao />}>
            <Route element={<Layout />}>
              {ITENS_DE_MENU.map((item) => {
                const Pagina = PAGINAS[item.recurso] ?? EmBreve;
                return (
                  <Route
                    key={item.recurso}
                    path={item.caminho}
                    caseSensitive
                    element={
                      <Protegida recurso={item.recurso}>
                        <Pagina />
                      </Protegida>
                    }
                  />
                );
              })}
              <Route path="*" element={<NaoEncontrada />} />
            </Route>
          </Route>
        </Routes>
        </ProvedorDeAvisos>
      </ProvedorDeAutenticacao>
    </BrowserRouter>
  );
}
