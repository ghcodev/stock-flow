import { useCallback, useEffect, useRef, useState, type KeyboardEvent as EventoDeTeclado } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router";
import "../estilos/layout.css";
import { useAutenticacao } from "../autenticacao/ContextoDeAutenticacao.tsx";
import { iniciais, rotuloDoPerfil } from "../autenticacao/credenciais.ts";
import { itemDoCaminho, menuDoPerfil } from "../sessao/navegacao.ts";
import { useConsultaDeMidia } from "../tema/useConsultaDeMidia.ts";
import { useTema } from "../tema/useTema.ts";
import { Icone } from "./Icone.tsx";

const CONSULTA_MOVEL = "(max-width: 900px)";

export function Layout() {
  const { sessao, sair } = useAutenticacao();
  const { tema, alternar } = useTema();
  const local = useLocation();
  const navegar = useNavigate();
  const movel = useConsultaDeMidia(CONSULTA_MOVEL);
  const [aberto, setAberto] = useState(() => !window.matchMedia(CONSULTA_MOVEL).matches);
  const botaoDoMenu = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLElement>(null);
  const conteudo = useRef<HTMLElement>(null);
  const primeiraNavegacao = useRef(true);
  const movelAtual = useRef(movel);
  movelAtual.current = movel;

  useEffect(() => {
    setAberto(!movel);
  }, [movel]);

  useEffect(() => {
    if (primeiraNavegacao.current) {
      primeiraNavegacao.current = false;
      return;
    }
    if (movelAtual.current) setAberto(false);
    conteudo.current?.focus();
  }, [local.pathname]);

  const gavetaAberta = movel && aberto;

  const fecharGaveta = useCallback(() => {
    setAberto(false);
    botaoDoMenu.current?.focus();
  }, []);

  useEffect(() => {
    if (!gavetaAberta) return;
    menu.current?.querySelector<HTMLElement>("a")?.focus();
    const aoTeclar = (evento: KeyboardEvent) => {
      if (evento.key === "Escape") fecharGaveta();
    };
    document.addEventListener("keydown", aoTeclar);
    return () => document.removeEventListener("keydown", aoTeclar);
  }, [gavetaAberta, fecharGaveta]);

  const prenderFoco = (evento: EventoDeTeclado<HTMLElement>) => {
    if (!gavetaAberta || evento.key !== "Tab") return;
    const focaveis = Array.from(evento.currentTarget.querySelectorAll<HTMLElement>("a[href], button:not([disabled])"));
    const primeiro = focaveis[0];
    const ultimo = focaveis[focaveis.length - 1];
    if (!primeiro || !ultimo) return;
    if (evento.shiftKey && document.activeElement === primeiro) {
      evento.preventDefault();
      ultimo.focus();
    } else if (!evento.shiftKey && document.activeElement === ultimo) {
      evento.preventDefault();
      primeiro.focus();
    }
  };

  const usuario = sessao?.usuario;
  const grupos = menuDoPerfil(usuario?.perfil ?? null);
  const tituloDaPagina = itemDoCaminho(local.pathname)?.rotulo ?? "Página não encontrada";
  const classes = ["app-shell", !aberto && !movel ? "app-shell--recolhido" : "", gavetaAberta ? "app-shell--gaveta" : ""]
    .filter((c) => c !== "")
    .join(" ");

  const sairDoSistema = () => {
    sair();
    navegar("/entrar", { replace: true });
  };

  return (
    <div className={classes}>
      <a className="pular-para-conteudo" href="#conteudo">
        Ir para o conteúdo
      </a>

      <aside id="menu-lateral" className="sidebar" ref={menu} onKeyDown={prenderFoco} aria-label="Menu lateral">
        <div className="sidebar-header">
          <div className="marca-icone">
            <Icone nome="box" />
          </div>
          <div className="marca-texto">StockFlow</div>
        </div>

        <nav className="sidebar-nav" aria-label="Navegação principal">
          {grupos.map((grupo) => (
            <div key={grupo.rotulo} className="sidebar-bloco">
              <div className="sidebar-grupo">{grupo.rotulo}</div>
              {grupo.itens.map((item) => (
                <NavLink
                  key={item.recurso}
                  to={item.caminho}
                  end={item.caminho === "/"}
                  className={({ isActive }) => (isActive ? "nav-item ativo" : "nav-item")}
                >
                  <Icone nome={item.icone} />
                  <span>{item.rotulo}</span>
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="avatar" aria-hidden="true">
            {iniciais(usuario?.nome ?? "")}
          </div>
          <div className="sidebar-usuario">
            <div className="sidebar-usuario-nome" title={usuario?.nome}>
              {usuario?.nome}
            </div>
            <div className="sidebar-usuario-perfil">{usuario ? rotuloDoPerfil(usuario.perfil) : ""}</div>
          </div>
          <button type="button" className="sidebar-sair" onClick={sairDoSistema} aria-label="Sair do sistema" title="Sair">
            <Icone nome="logout" />
          </button>
        </div>
      </aside>

      {gavetaAberta ? <div className="sidebar-fundo" onClick={fecharGaveta} aria-hidden="true" /> : null}

      <div className="main">
        <header className="topbar">
          <button
            type="button"
            ref={botaoDoMenu}
            className="icon-btn"
            onClick={() => setAberto((atual) => !atual)}
            aria-label="Menu de navegação"
            aria-expanded={aberto}
            aria-controls="menu-lateral"
          >
            <Icone nome="menu" />
          </button>
          <nav className="breadcrumb" aria-label="Trilha de navegação">
            <span className="breadcrumb-raiz">StockFlow</span>
            <span className="breadcrumb-sep" aria-hidden="true">
              /
            </span>
            <span className="breadcrumb-atual" aria-current="page">
              {tituloDaPagina}
            </span>
          </nav>
          <div className="topbar-acoes">
            <button
              type="button"
              className="icon-btn"
              onClick={alternar}
              aria-label={tema === "escuro" ? "Mudar para o tema claro" : "Mudar para o tema escuro"}
            >
              <Icone nome={tema === "escuro" ? "sun" : "moon"} />
            </button>
            <div className="topbar-divisor" aria-hidden="true" />
            <div className="topbar-avatar" title={usuario?.nome} aria-hidden="true">
              {iniciais(usuario?.nome ?? "")}
            </div>
          </div>
        </header>

        <main id="conteudo" className="pagina" ref={conteudo} tabIndex={-1}>
          <div className="pagina-interna">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
