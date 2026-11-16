import { Component, type ReactNode } from "react";
import { Icone } from "./Icone.tsx";

type Propriedades = {
  children: ReactNode;
  aoTentarDeNovo: () => void;
};

type Estado = { falhou: boolean };

export class BarreiraDeErros extends Component<Propriedades, Estado> {
  override state: Estado = { falhou: false };

  static getDerivedStateFromError(): Estado {
    return { falhou: true };
  }

  private tentarDeNovo = () => {
    this.props.aoTentarDeNovo();
    this.setState({ falhou: false });
  };

  private recarregar = () => {
    window.location.reload();
  };

  override render(): ReactNode {
    if (!this.state.falhou) return this.props.children;
    return (
      <div className="estado estado--erro" role="alert">
        <Icone nome="alert-triangle" />
        <strong>Não foi possível exibir esta tela</strong>
        <span>Verifique a conexão e tente de novo. Se continuar, recarregue a aplicação: o que foi digitado nesta tela pode ser perdido.</span>
        <div className="estado-acoes">
          <button type="button" className="btn btn-outline btn-sm" onClick={this.tentarDeNovo}>
            <Icone nome="refresh" />
            Tentar de novo
          </button>
          <button type="button" className="btn btn-primary btn-sm" onClick={this.recarregar}>
            Recarregar a aplicação
          </button>
        </div>
      </div>
    );
  }
}
