# StockFlow v3.0 — Frontend

SPA em React 19 + TypeScript (strict) + Vite 8 + React Router 7. Sem biblioteca de UI, de gráficos, de formulários, de estado, de datas nem de requisições: o cliente da API usa `fetch` nativo e os gráficos são SVG puro.

## Requisitos

Node 22.18 ou superior (o mesmo do backend). Dependências com versão exata (`npm install --save-exact`).

## Rodar

```
npm install
npm run dev        # desenvolvimento, http://localhost:5173
npm run build      # tsc --noEmit e vite build, saída em dist/
npm run preview    # serve o build de produção, http://localhost:4173
```

A API (backend) precisa estar de pé em `http://127.0.0.1:3000`. O cliente chama sempre `/api/...`.

### Como o `/api` é servido

- **Desenvolvimento e `preview`:** o proxy do Vite (`server.proxy` em `vite.config.ts`, que o `preview` herda) repassa `/api/*` para a API removendo o prefixo (`/api/health` vira `GET /health`). O alvo padrão é `http://127.0.0.1:3000`; para outro, defina `API_ALVO` antes de subir o Vite. Navegador e API ficam na mesma origem, então o backend não precisa de CORS.
- **Etapa 4 (produção):** o Nginx faz o papel do proxy: serve `dist/` como arquivos estáticos (com `try_files` para `index.html`, porque as rotas são do React Router), repassa `/api/` para a API removendo o prefixo e termina o HTTPS. O frontend não muda: continua chamando `/api`.

## Scripts

- `npm run dev`, `npm run build`, `npm run preview`: ver acima.
- `npm run typecheck`: só a checagem de tipos.
- `npm test`: `node:test` com remoção de tipos do Node, sobre a lógica pura em `.ts`.

## Estrutura

```
src/
  api/            cliente fetch (timeout, cancelamento, 401, download) e uma função por endpoint
  autenticacao/   contexto da sessão, rota protegida, regras do login
  componentes/    peças visuais reutilizáveis (tabela, campos, gaveta, modal, seletor com busca, avisos)
  estilos/        tokens.css (única fonte de cor) e uma folha por área
  hooks/          useCarregar (carga com vigência), useListaComCursor, useHorarioDoSucesso
  leitor/         captura global de leitor de código, detector de leitura rápida, Web Serial
  paginas/        uma tela por rota; subpastas guardam as peças específicas de cada tela
  sessao/         sessão em sessionStorage, permissões (seção 17.2) e menu
  tema/           tema claro e escuro
  util/           lógica pura e testada: decimais em BigInt, datas, validações, cursores, gráfico
tests/            testes da lógica pura
```

As telas, exceto Dashboard e Entrar, são carregadas sob demanda por rota (`import()` dinâmico do Vite, sem pacote novo).

## Decisões de projeto

- **Decimais como texto.** Quantidades e saldos (`NUMERIC`) chegam como texto e nunca passam por `parseFloat` em conta de saldo: comparação, soma, subtração e divergência usam `BigInt` (`util/decimal.ts`).
- **Datas.** Dia (`AAAA-MM-DD`) é formatado em UTC, sem deslocamento de fuso. Data e hora de Auditoria, Histórico, Rastreabilidade e Inventário aparecem em **UTC** e estão rotuladas, porque o filtro de período da API também é UTC. A janela de 30 dias do gráfico do Dashboard usa só o `data_referencia` devolvido pela API (o `current_date` do banco), nunca o relógio do navegador.
- **Vigência.** Só a última consulta altera a tela: dados de uma consulta antiga ou de outro filtro não aparecem. Repetir a mesma busca consulta de novo.
- **Escrita nunca é repetida sozinha.** Envio único (duplo clique gera uma requisição); resposta desconhecida (rede ou 5xx) avisa e manda conferir antes de repetir; 409 de saldo desatualizado recarrega o saldo e pede nova confirmação.
- **Listas com cursor** (Auditoria, Histórico, Rastreabilidade): o cursor vem sempre da resposta, nunca é reconstruído; trocar o filtro reinicia a lista. A tela renderiza no máximo 300 itens: ao passar disso, os primeiros registros já carregados são ocultados (com aviso e o botão "Voltar ao início"), e o cursor do servidor continua valendo.
- **Permissões.** Rota, menu e botões seguem o perfil, mas o backend é a autoridade. Administrador: Usuários, Auditoria, Ajuste de estoque, finalizar e cancelar contagem, exportar CSV.
- **Sessão.** Token JWT só em `sessionStorage`; 401 encerra a sessão; depois de editar o próprio usuário a sessão é relida por `/auth/me`.
- **Nada de HTML vindo da API.** Todo dado da API é texto; não há `dangerouslySetInnerHTML`. Valor anterior e novo da auditoria aparecem como texto.
- **Cores só em `src/estilos/tokens.css`** (única exceção: `public/favicon.svg`, que não enxerga variáveis CSS; exceção aprovada pelo Orquestrador). Os pares de texto e fundo dos dois temas foram conferidos para contraste de 4,5:1 (3:1 nas bordas de campos).
- **Acessibilidade.** Foco visível, gaveta e modal com foco preso, devolvido ao elemento de origem e fechados por ESC, rótulo em todo campo, `aria-live` nos avisos e contadores, `prefers-reduced-motion` respeitado.

## Leitor de código (RF10)

- A captura global trata o leitor que "digita" como teclado: leituras rápidas (média até 30 ms entre teclas, de 4 a 128 caracteres, terminadas por Enter) nas telas de lotes, entrada, saída, transferência, inventário, ajuste e rastreabilidade; campos editáveis são ignorados.
- A conexão por **Web Serial** (`navigator.serial`) só existe em navegador Chromium e em contexto seguro: **HTTPS ou `localhost`**. Em HTTP puro por IP da rede o navegador não oferece a API.

## O que não tem teste automatizado

- Componentes React, CSS e roteamento: conferidos no navegador e pelo roteiro da auditoria de frontend (larguras de 360 a 1920 px, temas claro e escuro, teclado, console, tempo entre a resposta e o DOM).
- **Web Serial com hardware:** a lógica de conexão e leitura tem teste com portas simuladas, mas nenhum leitor serial real foi testado.
- Download de arquivo (CSV) no navegador real foi verificado à mão; a lógica do nome seguro do arquivo tem teste.

## Limites conhecidos

- Janela de 300 itens renderizados nas listas com "carregar mais".
- Leitor serial sem hardware testado; Web Serial só em HTTPS ou `localhost`.
- O filtro por corredor no Mapa é texto livre (a API não tem endpoint de lista de corredores) e o mapa não colore posição por validade ou bloqueio (a API não devolve isso por posição).
- A contagem de inventário não mostra a unidade (a API não devolve o produto nela).
- Horários são exibidos em UTC.
- Reativar usuário não existe na API; a tela só inativa.

## Regras do projeto

- Nenhuma cor literal fora de `src/estilos/tokens.css`.
- Sem `dangerouslySetInnerHTML` com dado da API, sem `any`, sem `console.log`, sem comentários.
- Toda tela é protegida por padrão.
