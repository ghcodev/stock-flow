import { BrowserRouter, Route, Routes } from "react-router";
import { ProvedorDeAutenticacao } from "./autenticacao/ContextoDeAutenticacao.tsx";
import { Layout } from "./componentes/Layout.tsx";
import { ExigePermissao, ExigeSessao } from "./autenticacao/RotaProtegida.tsx";
import { ITENS_DE_MENU } from "./sessao/navegacao.ts";
import { EmBreve } from "./paginas/EmBreve.tsx";
import { Entrar } from "./paginas/Entrar.tsx";
import { NaoEncontrada } from "./paginas/NaoEncontrada.tsx";

export function App() {
  return (
    <BrowserRouter>
      <ProvedorDeAutenticacao>
        <Routes>
          <Route path="/entrar" element={<Entrar />} />
          <Route element={<ExigeSessao />}>
            <Route element={<Layout />}>
              <Route element={<ExigePermissao />}>
                {ITENS_DE_MENU.map((item) => (
                  <Route key={item.recurso} path={item.caminho} element={<EmBreve />} />
                ))}
                <Route path="*" element={<NaoEncontrada />} />
              </Route>
            </Route>
          </Route>
        </Routes>
      </ProvedorDeAutenticacao>
    </BrowserRouter>
  );
}
