import { useEffect, useRef, useState, type FormEvent } from "react";
import { Navigate, useLocation } from "react-router";
import "../estilos/entrar.css";
import "../estilos/cena.css";
import { useAutenticacao } from "../autenticacao/ContextoDeAutenticacao.tsx";
import {
  MENSAGEM_DE_CREDENCIAIS_INVALIDAS,
  destinoAposLogin,
  interpretarFalhaDoLogin,
  temErros,
  validarCredenciais,
  type ErrosDoLogin,
} from "../autenticacao/credenciais.ts";
import { CenaDeArmazem } from "../componentes/CenaDeArmazem.tsx";
import { Icone } from "../componentes/Icone.tsx";
import { pedirPermissaoDeMovimento, precisaDePermissaoDeMovimento, useParallax } from "../hooks/useParallax.ts";
import { useTema } from "../tema/useTema.ts";

export function Entrar() {
  const { sessao, entrar, aviso, limparAviso } = useAutenticacao();
  const { tema, alternar } = useTema();
  const local = useLocation();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [mostrar, setMostrar] = useState(false);
  const [erros, setErros] = useState<ErrosDoLogin>({});
  const [geral, setGeral] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const palco = useRef<HTMLDivElement>(null);
  const cartao = useRef<HTMLElement>(null);
  const [pedirMovimento, setPedirMovimento] = useState(precisaDePermissaoDeMovimento);
  const campoEmail = useRef<HTMLInputElement>(null);
  const campoSenha = useRef<HTMLInputElement>(null);
  const [foco, setFoco] = useState<"email" | "senha" | null>(null);

  useEffect(() => {
    if (foco === null || enviando) return;
    (foco === "email" ? campoEmail : campoSenha).current?.focus();
    setFoco(null);
  }, [foco, enviando]);

  if (sessao) {
    const origem = (local.state as { de?: unknown } | null)?.de;
    return <Navigate to={destinoAposLogin(origem)} replace />;
  }

  const campoComErro = (campos: ErrosDoLogin): "email" | "senha" | null => {
    if (campos.email !== undefined) return "email";
    return campos.senha !== undefined ? "senha" : null;
  };

  const enviar = async (evento: FormEvent<HTMLFormElement>) => {
    evento.preventDefault();
    if (enviando) return;
    const invalidos = validarCredenciais(email, senha);
    setErros(invalidos);
    setGeral(null);
    if (temErros(invalidos)) {
      setFoco(campoComErro(invalidos));
      return;
    }
    limparAviso();
    setEnviando(true);
    try {
      await entrar(email.trim(), senha);
    } catch (erro) {
      const falha = interpretarFalhaDoLogin(erro);
      setErros(falha.campos);
      setGeral(falha.geral);
      if (falha.geral === MENSAGEM_DE_CREDENCIAIS_INVALIDAS) {
        setSenha("");
        setFoco("senha");
      } else {
        setFoco(campoComErro(falha.campos));
      }
      setEnviando(false);
    }
  };

  useParallax((inclinacao) => {
    if (palco.current) palco.current.style.transform = `rotateX(${58 + inclinacao.y * 7}deg) rotateZ(${-38 + inclinacao.x * 12}deg)`;
    if (cartao.current) cartao.current.style.transform = `rotateY(${inclinacao.x * 3}deg) rotateX(${-inclinacao.y * 2}deg)`;
  });

  const mensagemGeral = geral ?? aviso;

  return (
    <div className="auth-shell">
      <aside className="auth-brand" aria-label="Apresentação do StockFlow">
        <CenaDeArmazem palco={palco} />
        <header className="auth-logo">
          <div className="marca-icone">
            <Icone nome="box" />
          </div>
          <div className="auth-logo-texto">StockFlow</div>
        </header>

        <div className="auth-brand-corpo">
          <div className="auth-eyebrow">Plataforma operacional de estoque</div>
          <h1 className="auth-titulo">
            Rastreabilidade de <em>lotes</em> do recebimento à expedição.
          </h1>
          <p className="auth-lede">
            Controle entradas, saídas, transferências e inventário em um único sistema, com alertas de vencimento e
            histórico de cada operação.
          </p>
          <ul className="auth-recursos">
            <li className="auth-recurso">
              <Icone nome="scan" />
              Rastreabilidade por lote
            </li>
            <li className="auth-recurso">
              <Icone nome="clock" />
              Alertas de vencimento
            </li>
            <li className="auth-recurso">
              <Icone nome="shield" />
              Auditoria de operações
            </li>
          </ul>
        </div>

        <footer className="auth-brand-rodape">StockFlow v3.0</footer>
        {pedirMovimento ? (
          <button
            type="button"
            className="auth-movimento"
            onClick={() => {
              void pedirPermissaoDeMovimento().then((concedida) => {
                if (concedida) setPedirMovimento(false);
              });
            }}
          >
            Ativar movimento do aparelho
          </button>
        ) : null}
      </aside>

      <section className="auth-form-painel">
        <div className="auth-form-topo">
          <div className="auth-logo-compacto">
            <div className="marca-icone">
              <Icone nome="box" />
            </div>
            StockFlow
          </div>
          <button
            type="button"
            className="icon-btn"
            onClick={alternar}
            aria-label={tema === "escuro" ? "Mudar para o tema claro" : "Mudar para o tema escuro"}
          >
            <Icone nome={tema === "escuro" ? "sun" : "moon"} />
          </button>
        </div>

        <main className="auth-form-corpo" ref={cartao}>
          <h2 className="auth-form-titulo">Entrar na sua conta</h2>
          <p className="auth-form-sub">Use o e-mail e a senha cadastrados para acessar o sistema.</p>

          <form onSubmit={enviar} noValidate aria-busy={enviando}>
            {mensagemGeral ? (
              <div className={geral ? "auth-aviso auth-aviso--erro" : "auth-aviso"} role={geral ? "alert" : "status"}>
                <Icone nome={geral ? "alert-triangle" : "info"} />
                <span>{mensagemGeral}</span>
              </div>
            ) : null}

            <div className="auth-campo">
              <label className="form-label" htmlFor="entrar-email">
                E-mail
              </label>
              <div className="auth-entrada">
                <Icone nome="mail" />
                <input
                  ref={campoEmail}
                  id="entrar-email"
                  name="email"
                  className="input"
                  type="email"
                  inputMode="email"
                  autoComplete="username"
                  autoCapitalize="none"
                  spellCheck={false}
                  maxLength={160}
                  placeholder="nome@empresa.com"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (erros.email !== undefined) setErros(({ email: _removido, ...resto }) => resto);
                  }}
                  aria-invalid={erros.email !== undefined}
                  aria-describedby={erros.email !== undefined ? "entrar-email-erro" : undefined}
                  disabled={enviando}
                />
              </div>
              {erros.email !== undefined ? (
                <div id="entrar-email-erro" className="form-error" role="alert">
                  <Icone nome="alert-triangle" />
                  <span>{erros.email}</span>
                </div>
              ) : null}
            </div>

            <div className="auth-campo">
              <label className="form-label" htmlFor="entrar-senha">
                Senha
              </label>
              <div className="auth-entrada auth-entrada--senha">
                <Icone nome="lock" />
                <input
                  ref={campoSenha}
                  id="entrar-senha"
                  name="senha"
                  className="input"
                  type={mostrar ? "text" : "password"}
                  autoComplete="current-password"
                  autoCapitalize="none"
                  spellCheck={false}
                  placeholder="Sua senha"
                  value={senha}
                  onChange={(e) => {
                    setSenha(e.target.value);
                    if (erros.senha !== undefined) setErros(({ senha: _removido, ...resto }) => resto);
                  }}
                  aria-invalid={erros.senha !== undefined}
                  aria-describedby={erros.senha !== undefined ? "entrar-senha-erro" : undefined}
                  disabled={enviando}
                />
                <button
                  type="button"
                  className="auth-mostrar-senha"
                  onClick={() => setMostrar((atual) => !atual)}
                  aria-label={mostrar ? "Ocultar senha" : "Mostrar senha"}
                  aria-pressed={mostrar}
                >
                  <Icone nome={mostrar ? "eye-off" : "eye"} />
                </button>
              </div>
              {erros.senha !== undefined ? (
                <div id="entrar-senha-erro" className="form-error" role="alert">
                  <Icone nome="alert-triangle" />
                  <span>{erros.senha}</span>
                </div>
              ) : null}
            </div>

            <button type="submit" className="btn btn-primary auth-enviar" disabled={enviando} aria-busy={enviando}>
              {enviando ? <span className="spinner" aria-hidden="true" /> : null}
              <span>{enviando ? "Entrando…" : "Entrar"}</span>
              {enviando ? null : <Icone nome="arrow-right" />}
            </button>
          </form>

          <div className="auth-rodape-form">
            <Icone nome="info" />
            <span>Problemas para acessar? Fale com o administrador do sistema.</span>
          </div>
        </main>
      </section>
    </div>
  );
}
