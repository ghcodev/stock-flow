import { useState, type FormEvent } from "react";
import { corpoDeLote, criarLote } from "../../api/lotes.ts";
import type { Localizacao, Lote, Produto } from "../../api/tipos.ts";
import { useAutenticacao } from "../../autenticacao/ContextoDeAutenticacao.tsx";
import { AvisoDoFormulario, CampoDeSelecao, CampoDeTexto, focarPrimeiroInvalido } from "../../componentes/Campo.tsx";
import { Gaveta } from "../../componentes/Gaveta.tsx";
import { Icone } from "../../componentes/Icone.tsx";
import { interpretarFalhaDeFormulario, temErrosDeCampos, validarLote, type ErrosDeCampos, type ValoresDeLote } from "../../util/formularios.ts";
import { rotuloDaLocalizacao } from "./apresentacao.ts";

type Propriedades = {
  produtos: readonly Produto[];
  localizacoes: readonly Localizacao[];
  aoFechar: () => void;
  aoSalvar: (lote: Lote) => void;
};

const ID_DO_FORMULARIO = "formulario-de-lote";

const VAZIO: ValoresDeLote = {
  numero_lote: "",
  id_produto: "",
  id_localizacao: "",
  quantidade: "",
  data_fabricacao: "",
  data_validade: "",
  etiqueta_tipo: "",
  etiqueta_codigo: "",
};

const CAMPOS_DA_API: Record<string, string> = { "etiqueta.tipo": "etiqueta_tipo", "etiqueta.codigo": "etiqueta_codigo" };

function traduzirCampos(campos: ErrosDeCampos): ErrosDeCampos {
  const traduzidos: ErrosDeCampos = {};
  for (const [campo, mensagem] of Object.entries(campos)) traduzidos[CAMPOS_DA_API[campo] ?? campo] = mensagem;
  return traduzidos;
}

export function FormularioDeLote({ produtos, localizacoes, aoFechar, aoSalvar }: Propriedades) {
  const { cliente } = useAutenticacao();
  const [valores, setValores] = useState<ValoresDeLote>(VAZIO);
  const [erros, setErros] = useState<ErrosDeCampos>({});
  const [geral, setGeral] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const alterar = (campo: keyof ValoresDeLote) => (valor: string) => {
    setValores((atuais) => ({ ...atuais, [campo]: valor }));
    setErros(({ [campo]: _removido, ...resto }) => resto);
  };

  const enviar = async (evento: FormEvent<HTMLFormElement>) => {
    evento.preventDefault();
    const formulario = evento.currentTarget;
    if (enviando) return;
    const invalidos = validarLote(valores);
    setErros(invalidos);
    setGeral(null);
    if (temErrosDeCampos(invalidos)) {
      focarPrimeiroInvalido(formulario);
      return;
    }
    setEnviando(true);
    try {
      aoSalvar(await criarLote(cliente, corpoDeLote(valores)));
    } catch (erro) {
      const falha = interpretarFalhaDeFormulario(erro);
      setErros(traduzirCampos(falha.campos));
      setGeral(falha.geral);
      setEnviando(false);
      focarPrimeiroInvalido(formulario);
    }
  };

  return (
    <Gaveta
      aberta
      titulo="Registrar lote"
      aoFechar={aoFechar}
      larga
      rodape={
        <>
          <button type="button" className="btn btn-outline" onClick={aoFechar} disabled={enviando}>
            Cancelar
          </button>
          <button type="submit" form={ID_DO_FORMULARIO} className="btn btn-primary" disabled={enviando} aria-busy={enviando}>
            {enviando ? <span className="spinner" aria-hidden="true" /> : <Icone nome="check" />}
            {enviando ? "Registrando…" : "Registrar lote"}
          </button>
        </>
      }
    >
      <AvisoDoFormulario mensagem={geral} />
      <form id={ID_DO_FORMULARIO} className="formulario formulario--duas-colunas" onSubmit={enviar} noValidate>
        <CampoDeSelecao
          largo
          obrigatorio
          rotulo="Produto"
          valor={valores.id_produto}
          aoMudar={alterar("id_produto")}
          erro={erros["id_produto"]}
          vazio="Selecione o produto"
          opcoes={produtos.map((produto) => ({ valor: String(produto.id_produto), rotulo: `${produto.nome} (${produto.unidade_medida})` }))}
          desabilitado={enviando}
          ajuda={produtos.length === 0 ? "Nenhum produto ativo disponível." : undefined}
        />
        <CampoDeTexto obrigatorio autoFoco rotulo="Número do lote" valor={valores.numero_lote} aoMudar={alterar("numero_lote")} erro={erros["numero_lote"]} tamanhoMaximo={50} desabilitado={enviando} />
        <CampoDeSelecao
          obrigatorio
          rotulo="Localização"
          valor={valores.id_localizacao}
          aoMudar={alterar("id_localizacao")}
          erro={erros["id_localizacao"]}
          vazio="Selecione a posição"
          opcoes={localizacoes.map((localizacao) => ({ valor: String(localizacao.id_localizacao), rotulo: rotuloDaLocalizacao(localizacao) }))}
          desabilitado={enviando}
        />
        <CampoDeTexto
          rotulo="Quantidade inicial"
          valor={valores.quantidade}
          aoMudar={alterar("quantidade")}
          erro={erros["quantidade"]}
          inputMode="decimal"
          ajuda="Acima de zero, registra a entrada inicial do lote."
          desabilitado={enviando}
        />
        <CampoDeTexto tipo="date" rotulo="Fabricação" valor={valores.data_fabricacao} aoMudar={alterar("data_fabricacao")} erro={erros["data_fabricacao"]} desabilitado={enviando} />
        <CampoDeTexto tipo="date" rotulo="Validade" valor={valores.data_validade} aoMudar={alterar("data_validade")} erro={erros["data_validade"]} desabilitado={enviando} />
        <CampoDeSelecao
          rotulo="Tipo da etiqueta"
          valor={valores.etiqueta_tipo}
          aoMudar={alterar("etiqueta_tipo")}
          erro={erros["etiqueta_tipo"]}
          vazio="Sem etiqueta"
          opcoes={[
            { valor: "qr_code", rotulo: "QR Code" },
            { valor: "rfid", rotulo: "RFID" },
          ]}
          desabilitado={enviando}
        />
        <CampoDeTexto
          rotulo="Código da etiqueta"
          valor={valores.etiqueta_codigo}
          aoMudar={alterar("etiqueta_codigo")}
          erro={erros["etiqueta_codigo"]}
          tamanhoMaximo={128}
          ajuda="Opcional. Cada código só pode ser usado em um lote."
          desabilitado={enviando}
        />
      </form>
    </Gaveta>
  );
}
