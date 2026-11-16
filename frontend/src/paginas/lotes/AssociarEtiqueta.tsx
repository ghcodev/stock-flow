import { useState, type FormEvent } from "react";
import { associarEtiqueta } from "../../api/lotes.ts";
import type { Etiqueta, Lote, TipoEtiqueta } from "../../api/tipos.ts";
import { useAutenticacao } from "../../autenticacao/ContextoDeAutenticacao.tsx";
import { AvisoDoFormulario, CampoDeSelecao, CampoDeTexto, focarPrimeiroInvalido } from "../../componentes/Campo.tsx";
import { Modal } from "../../componentes/Modal.tsx";
import { interpretarFalhaDeFormulario, temErrosDeCampos, validarEtiqueta, type ErrosDeCampos } from "../../util/formularios.ts";

type Propriedades = {
  lote: Lote;
  aoCancelar: () => void;
  aoAssociar: (etiqueta: Etiqueta) => void;
};

const ID_DO_FORMULARIO = "formulario-de-etiqueta";

export function AssociarEtiqueta({ lote, aoCancelar, aoAssociar }: Propriedades) {
  const { cliente } = useAutenticacao();
  const [tipo, setTipo] = useState("");
  const [codigo, setCodigo] = useState("");
  const [erros, setErros] = useState<ErrosDeCampos>({});
  const [geral, setGeral] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const enviar = async (evento: FormEvent<HTMLFormElement>) => {
    evento.preventDefault();
    const formulario = evento.currentTarget;
    if (enviando) return;
    const invalidos = validarEtiqueta(tipo, codigo);
    setErros(invalidos);
    setGeral(null);
    if (temErrosDeCampos(invalidos)) {
      focarPrimeiroInvalido(formulario);
      return;
    }
    setEnviando(true);
    try {
      aoAssociar(await associarEtiqueta(cliente, lote.id_lote, tipo as TipoEtiqueta, codigo));
    } catch (falha) {
      const resultado = interpretarFalhaDeFormulario(falha);
      setErros(resultado.campos);
      setGeral(resultado.geral);
      setEnviando(false);
      focarPrimeiroInvalido(formulario);
    }
  };

  return (
    <Modal
      aberto
      titulo="Associar etiqueta"
      aoFechar={enviando ? () => undefined : aoCancelar}
      rodape={
        <>
          <button type="button" className="btn btn-outline" onClick={aoCancelar} disabled={enviando}>
            Cancelar
          </button>
          <button type="submit" form={ID_DO_FORMULARIO} className="btn btn-primary" disabled={enviando} aria-busy={enviando}>
            {enviando ? <span className="spinner" aria-hidden="true" /> : null}
            {enviando ? "Associando…" : "Associar"}
          </button>
        </>
      }
    >
      <AvisoDoFormulario mensagem={geral} />
      <p>
        Vincule uma etiqueta ao lote <strong>{lote.numero_lote}</strong>. A associação não pode ser alterada depois.
      </p>
      <form id={ID_DO_FORMULARIO} className="formulario" onSubmit={enviar} noValidate>
        <CampoDeSelecao
          obrigatorio
          rotulo="Tipo da etiqueta"
          valor={tipo}
          aoMudar={(valor) => {
            setTipo(valor);
            setErros(({ tipo: _removido, ...resto }) => resto);
          }}
          erro={erros["tipo"]}
          vazio="Selecione o tipo"
          opcoes={[
            { valor: "qr_code", rotulo: "QR Code" },
            { valor: "rfid", rotulo: "RFID" },
          ]}
          desabilitado={enviando}
        />
        <CampoDeTexto
          obrigatorio
          rotulo="Código da etiqueta"
          valor={codigo}
          aoMudar={(valor) => {
            setCodigo(valor);
            setErros(({ codigo: _removido, ...resto }) => resto);
          }}
          erro={erros["codigo"]}
          tamanhoMaximo={128}
          desabilitado={enviando}
        />
      </form>
    </Modal>
  );
}
