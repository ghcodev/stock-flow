import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { consultarUsuarioAtual, entrar as entrarNaApi } from "../api/autenticacao.ts";
import { criarCliente, type Cliente } from "../api/cliente.ts";
import { capturaGlobal } from "../leitor/captura.ts";
import { gerenciadorSerial } from "../leitor/gerenciador.ts";
import { MENSAGEM_DE_SESSAO_EXPIRADA, expiracaoDoToken, lerSessaoSalva, limparSessao, salvarSessao, tokenVigente, type Armazenamento, type Sessao } from "../sessao/sessao.ts";

type Valor = {
  sessao: Sessao | null;
  cliente: Cliente;
  aviso: string | null;
  entrar: (email: string, senha: string) => Promise<void>;
  sair: () => void;
  limparAviso: () => void;
};

const LIMITE_DO_TEMPORIZADOR_MS = 2_147_483_000;

const Contexto = createContext<Valor | null>(null);

function armazenamentoDaAba(): Armazenamento {
  try {
    return window.sessionStorage;
  } catch {
    const dados = new Map<string, string>();
    return {
      getItem: (chave) => dados.get(chave) ?? null,
      setItem: (chave, valor) => void dados.set(chave, valor),
      removeItem: (chave) => void dados.delete(chave),
    };
  }
}

export function ProvedorDeAutenticacao({ children, armazenamento }: { children: ReactNode; armazenamento?: Armazenamento }) {
  const memoria = useMemo(() => armazenamento ?? armazenamentoDaAba(), [armazenamento]);
  const [inicial] = useState(() => lerSessaoSalva(memoria, Date.now()));
  const [sessao, setSessao] = useState<Sessao | null>(inicial.sessao);
  const [aviso, setAviso] = useState<string | null>(inicial.expirada ? MENSAGEM_DE_SESSAO_EXPIRADA : null);
  const sessaoAtual = useRef<Sessao | null>(sessao);

  useEffect(() => {
    if (inicial.sessao === null) limparSessao(memoria);
  }, [inicial, memoria]);

  const definir = useCallback(
    (nova: Sessao | null) => {
      sessaoAtual.current = nova;
      if (nova) salvarSessao(memoria, nova);
      else {
        limparSessao(memoria);
        gerenciadorSerial().desconectar();
        capturaGlobal().habilitar(false);
      }
      setSessao(nova);
    },
    [memoria],
  );

  const encerrarPorExpiracao = useCallback(() => {
    if (sessaoAtual.current === null) return;
    definir(null);
    setAviso(MENSAGEM_DE_SESSAO_EXPIRADA);
  }, [definir]);

  const cliente = useMemo(
    () =>
      criarCliente({
        buscar: (entrada, init) => fetch(entrada, init),
        obterToken: () => sessaoAtual.current?.token ?? null,
        aoNaoAutorizado: encerrarPorExpiracao,
      }),
    [encerrarPorExpiracao],
  );

  const entrar = useCallback(
    async (email: string, senha: string) => {
      const resultado = await entrarNaApi(cliente, email, senha);
      setAviso(null);
      definir({ token: resultado.token, usuario: resultado.usuario });
    },
    [cliente, definir],
  );

  const sair = useCallback(() => {
    setAviso(null);
    definir(null);
  }, [definir]);

  const limparAviso = useCallback(() => setAviso(null), []);

  const token = sessao?.token ?? null;

  useEffect(() => {
    if (token === null) return;
    const expiracao = expiracaoDoToken(token);
    if (expiracao === null) return;
    const temporizador = window.setTimeout(encerrarPorExpiracao, Math.min(Math.max(expiracao - Date.now(), 0), LIMITE_DO_TEMPORIZADOR_MS));
    const conferir = () => {
      if (!tokenVigente(token, Date.now())) encerrarPorExpiracao();
    };
    document.addEventListener("visibilitychange", conferir);
    window.addEventListener("focus", conferir);
    return () => {
      window.clearTimeout(temporizador);
      document.removeEventListener("visibilitychange", conferir);
      window.removeEventListener("focus", conferir);
    };
  }, [token, encerrarPorExpiracao]);

  useEffect(() => {
    if (token === null) return;
    const controle = new AbortController();
    consultarUsuarioAtual(cliente, controle.signal).then(
      (usuario) => {
        const atual = sessaoAtual.current;
        if (atual && atual.token === token && (atual.usuario.perfil !== usuario.perfil || atual.usuario.nome !== usuario.nome)) {
          definir({ token, usuario });
        }
      },
      () => undefined,
    );
    return () => controle.abort();
  }, [token, cliente, definir]);

  const valor = useMemo<Valor>(
    () => ({ sessao, cliente, aviso, entrar, sair, limparAviso }),
    [sessao, cliente, aviso, entrar, sair, limparAviso],
  );

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export function useAutenticacao(): Valor {
  const valor = useContext(Contexto);
  if (valor === null) throw new Error("useAutenticacao fora do ProvedorDeAutenticacao");
  return valor;
}
