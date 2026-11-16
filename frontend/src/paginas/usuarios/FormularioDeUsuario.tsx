import { useRef, useState, type FormEvent } from "react";
import { atualizarUsuario, criarUsuario, type UsuarioGerenciado } from "../../api/usuarios.ts";
import { useAutenticacao } from "../../autenticacao/ContextoDeAutenticacao.tsx";
import { AvisoDoFormulario, CampoDeSelecao, CampoDeTexto, focarPrimeiroInvalido } from "../../componentes/Campo.tsx";
import { CampoDeSenha } from "../../componentes/CampoDeSenha.tsx";
import { Gaveta } from "../../componentes/Gaveta.tsx";
import { Icone } from "../../componentes/Icone.tsx";
import { criarEnvioUnico } from "../../util/envio.ts";
import { temErrosDeCampos, type ErrosDeCampos } from "../../util/formularios.ts";
import {
  VALORES_DE_USUARIO_VAZIOS,
  corpoDeCriacao,
  corpoDeEdicao,
  interpretarFalhaDeUsuario,
  semAlteracao,
  validarUsuario,
  type ValoresDeUsuario,
} from "../../util/usuarios.ts";

type Propriedades = {
  usuario: UsuarioGerenciado | null;
  aoFechar: () => void;
  aoResultadoIncerto: () => void;
  aoSalvar: (usuario: UsuarioGerenciado, criado: boolean) => void;
};

export const ID_DO_FORMULARIO_DE_USUARIO = "formulario-de-usuario";

const PERFIS = [
  { valor: "administrador", rotulo: "Administrador" },
  { valor: "operador", rotulo: "Operador" },
];

function valoresIniciais(usuario: UsuarioGerenciado | null): ValoresDeUsuario {
  return usuario ? { nome: usuario.nome, email: usuario.email, perfil: usuario.perfil, senha: "" } : VALORES_DE_USUARIO_VAZIOS;
}

export function FormularioDeUsuario({ usuario, aoFechar, aoSalvar, aoResultadoIncerto }: Propriedades) {
  const { cliente } = useAutenticacao();
  const [valores, setValores] = useState<ValoresDeUsuario>(() => valoresIniciais(usuario));
  const [erros, setErros] = useState<ErrosDeCampos>({});
  const [geral, setGeral] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const envio = useRef(criarEnvioUnico());

  const alterar = (campo: keyof ValoresDeUsuario) => (valor: string) => {
    setValores((atuais) => ({ ...atuais, [campo]: valor }));
    setErros(({ [campo]: _removido, ...resto }) => resto);
  };

  const enviar = (evento: FormEvent<HTMLFormElement>) => {
    evento.preventDefault();
    const formulario = evento.currentTarget;
    if (envio.current.ocupado()) return;
    const invalidos = validarUsuario(valores, usuario === null);
    setErros(invalidos);
    setGeral(null);
    if (temErrosDeCampos(invalidos)) {
      focarPrimeiroInvalido(formulario);
      return;
    }
    const execucao = envio.current.executar(async () => {
      if (usuario === null) return criarUsuario(cliente, corpoDeCriacao(valores));
      const corpo = corpoDeEdicao(valores, usuario);
      if (semAlteracao(corpo)) return null;
      return atualizarUsuario(cliente, usuario.id_usuario, corpo);
    });
    if (execucao === null) return;
    setEnviando(true);
    execucao.then(
      (salvo) => {
        setValores((atuais) => ({ ...atuais, senha: "" }));
        if (salvo === null) {
          setGeral("Nenhuma alteração para salvar.");
          setEnviando(false);
          return;
        }
        aoSalvar(salvo, usuario === null);
      },
      (falha: unknown) => {
        const resultado = interpretarFalhaDeUsuario(falha);
        if (resultado.incerta) aoResultadoIncerto();
        setValores((atuais) => ({ ...atuais, senha: "" }));
        setErros(resultado.campos);
        setGeral(resultado.geral);
        setEnviando(false);
        focarPrimeiroInvalido(formulario);
      },
    );
  };

  return (
    <Gaveta
      aberta
      bloqueada={enviando}
      titulo={usuario ? "Editar usuário" : "Novo usuário"}
      subtitulo={usuario ? `#${usuario.id_usuario}` : undefined}
      aoFechar={aoFechar}
      rodape={
        <>
          <button type="button" className="btn btn-outline" onClick={aoFechar} disabled={enviando}>
            Cancelar
          </button>
          <button type="submit" form={ID_DO_FORMULARIO_DE_USUARIO} className="btn btn-primary" disabled={enviando} aria-busy={enviando}>
            {enviando ? <span className="spinner" aria-hidden="true" /> : <Icone nome="check" />}
            {enviando ? "Salvando…" : "Salvar"}
          </button>
        </>
      }
    >
      <AvisoDoFormulario mensagem={geral} />
      <form id={ID_DO_FORMULARIO_DE_USUARIO} className="formulario" onSubmit={enviar} noValidate autoComplete="off">
        <CampoDeTexto obrigatorio autoFoco rotulo="Nome" valor={valores.nome} aoMudar={alterar("nome")} erro={erros["nome"]} tamanhoMaximo={120} desabilitado={enviando} />
        <CampoDeTexto obrigatorio rotulo="E-mail" valor={valores.email} aoMudar={alterar("email")} erro={erros["email"]} tamanhoMaximo={160} desabilitado={enviando} />
        <CampoDeSelecao obrigatorio rotulo="Perfil" valor={valores.perfil} aoMudar={alterar("perfil")} erro={erros["perfil"]} vazio="Selecione o perfil" opcoes={PERFIS} desabilitado={enviando} />
        <CampoDeSenha
          obrigatorio={usuario === null}
          rotulo={usuario ? "Nova senha (opcional)" : "Senha"}
          valor={valores.senha}
          aoMudar={alterar("senha")}
          erro={erros["senha"]}
          ajuda={usuario ? "Deixe em branco para manter a senha atual. Mínimo de 8 caracteres e até 72 bytes." : "Mínimo de 8 caracteres e até 72 bytes."}
          desabilitado={enviando}
        />
      </form>
    </Gaveta>
  );
}
