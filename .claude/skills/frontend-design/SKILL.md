---
name: frontend-design
description: Padrao obrigatorio de UX, UI e frontend para criacao ou refatoracao de telas do StockFlow.
---

# StockFlow Frontend Design

Use esta skill antes de qualquer criacao, melhoria ou refatoracao de telas, componentes visuais, layouts, tabelas, dashboards, formularios, cards, filtros ou navegacao.

## Filosofia Do Produto

O StockFlow nao e um CRUD simples, painel administrativo generico ou template academico.

O StockFlow e uma plataforma de inteligencia operacional, WMS moderno e sistema industrial enterprise para tomada de decisao.

Referencias visuais obrigatorias:
- SAP Fiori
- Oracle ERP
- Microsoft Dynamics
- Palantir Foundry
- IBM Carbon
- Siemens Industrial Software

## Principios

- Informacao antes de decoracao.
- Densidade profissional, sem espacos vazios excessivos.
- KPIs precisam responder qual decisao o operador pode tomar.
- Menos paginas, mais contexto: preferir drawer lateral, painel contextual e expandir linha.
- Alteracoes cirurgicas, preservando design system e comportamento existente.

## Padroes Visuais

- Usar exclusivamente tokens CSS existentes: `var(--color-*)`, `var(--radius-*)`, `var(--shadow-*)`.
- Nao usar hex hardcoded, `rgb()` ou `hsl()`.
- Nao introduzir paleta paralela.
- Evitar decoracao sem funcao operacional.
- Microinteracoes permitidas: hover, fade, slide e highlight discretos.
- Proibido bounce, efeitos chamativos e animacoes decorativas.

## Tabelas

Obrigatorio:
- Sticky header.
- Hover de linha.
- Ordenacao nas colunas operacionais.
- Busca.
- Filtros rapidos.
- Paginacao ou indicador claro de quantidade exibida.
- Acoes agrupadas em menu contextual `⋮`.

Sempre que possivel:
- Drawer lateral ao clicar no item principal.
- Destaque visual para itens criticos.

Evitar:
- Muitos icones soltos por linha.
- Texto redundante.
- Colunas largas com informacao pouco escaneavel.

## KPI Strip

Obrigatorio:
- Cards compactos.
- Valor principal.
- Contexto operacional.
- Icone discreto.
- Grid responsivo.
- Mesmo padrao visual do Dashboard.

Evitar:
- Cards grandes com pouco dado.
- Mini graficos decorativos.
- KPI sem decisao operacional clara.

## Filtros Rapidos

Obrigatorio:
- Aplicacao instantanea.
- Contador por filtro.
- Combinar com busca.
- Estado ativo claro.

## Drawer Lateral

Usar drawer em vez de modal quando o usuario precisa manter contexto da tabela.

Obrigatorio:
- Abrir ao clicar no identificador principal.
- Fechar por `ESC`.
- Fechar por botao claro.
- Conteudo estruturado por informacao operacional.
- Acoes relevantes no rodape.

## Badges

- Usar classes e tokens existentes quando possivel.
- Diferenciar status, risco e prioridade.
- Evitar exagero visual.

## Acoes Por Menu

- Usar `⋮` por linha.
- Menu com texto claro: Visualizar, Editar, Historico, Movimentacoes, Rastreabilidade.
- Ocultar ou desabilitar acoes sem funcionalidade segura.
- Nao espalhar varios icones por linha.

## Busca

- Placeholder claro.
- Busca instantanea quando os dados ja estiverem carregados.
- Pesquisar por campos operacionais relevantes.

## Hover

- Hover suave em linhas, botoes e chips.
- Sem deslocamento agressivo.
- Feedback visual deve ajudar foco e escaneabilidade.

## Restricoes

- Nao instalar bibliotecas.
- Nao alterar regras de negocio sem necessidade.
- Nao alterar APIs existentes sem necessidade.
- Nao reescrever tela inteira.
- Nao alterar `package.json` ou `package-lock.json` para UI.
- Graficos devem usar SVG puro; proibido adicionar biblioteca de grafico.
- Preservar performance.
- Preservar responsividade.

## Processo Obrigatorio

Antes de implementar:
1. Analisar a tela atual.
2. Identificar problemas visuais, UX e operacionais.
3. Propor melhorias.
4. Mostrar diff planejado.
5. Aguardar aprovacao explicita.

Depois da implementacao:
1. Executar `frontend-audit`.
2. Corrigir problemas obrigatorios.
3. Validar novamente.
4. Listar arquivos alterados.
