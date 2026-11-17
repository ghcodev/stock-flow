# StockFlow v3.0 — Backend

Node 22.18+ (type stripping nativo no desenvolvimento), Express 5, Prisma 7, PostgreSQL 16.

## Instalar

```
cd backend
npm ci
cp .env.example .env
```

Preencha `.env`: `DATABASE_URL` (role `stockflow_app`, porta 5433 do Docker), `JWT_SECRET` (mínimo 32 caracteres, aleatório) e, se quiser, `PORT`. O token JWT dura sempre 8 h (fixo no código). A aplicação recusa subir sem `DATABASE_URL` ou `JWT_SECRET`.

O banco sobe com `docker compose up -d` na raiz. O esquema é o de `database/postgres/init`; o Prisma não cria migrations.

## Gerar o cliente Prisma

```
npm run generate
```

O cliente vai para `src/generated/prisma`, ignorado pelo git. `npm run build` já o gera.

## Esquema e banco

O esquema do banco é definido só em `database/postgres/init`. CHECKs, triggers, permissões da role e o `ON DELETE RESTRICT` ficam apenas no SQL; o Prisma não os gerencia. Não use `prisma db push` nem migrations do Prisma.

`prisma/schema.prisma` vem de `npm run db:pull`. O pull recoloca três comentários `///` (modelos `lote`, `movimentacao` e `produto`, sobre CHECKs). Depois de cada pull, remova-os: `sed -i '/^\/\/\/ /d' prisma/schema.prisma`.

## Rodar

```
npm run dev
npm run typecheck
npm run build
npm run start:local
```

- `npm run dev`: desenvolvimento, lê o `.env` (`--env-file`) e recarrega ao salvar.
- `npm run start:local`: roda o build (`dist/`) lendo o `.env`.
- `npm start`: produção. Não lê `.env`; as variáveis (`DATABASE_URL`, `JWT_SECRET`, `PORT`) vêm do ambiente, em produção do Docker Compose.

## Testar

```
npm test
```

Usa `node:test` contra o PostgreSQL do Docker, com o app em porta efêmera. Os testes não dependem do seed.

Atenção: a suíte escreve no banco. Cada execução completa persiste usuários de teste (e-mail único, `@teste.local`, deixados inativos), produtos (deixados inativos), localizações, lotes, etiquetas, movimentações de entrada dos saldos iniciais e as linhas de `auditoria_log` geradas pelos triggers. Nada é apagado, porque a role da aplicação não tem DELETE, então esses dados se acumulam a cada execução. Rode a suíte só contra banco de desenvolvimento ou de teste, nunca contra produção.

## Listagem de localizações

`GET /localizacoes?busca=<texto>` (operador e administrador, paginado) casa o texto, sem diferenciar caixa, com corredor, nível, posição ou descrição (contém) **e também com o rótulo combinado** `corredor-nível-posição`: `A-1-01`, `a 1 01`, `A/1/01` e trechos como `1-01` encontram a posição A-1-01. Espaços e barras viram hífen antes de comparar. O filtro roda no banco antes do limite, com parâmetros ligados e `%`, `_` e `\` tratados como texto literal. Ordem do resultado com busca: rótulo igual ao digitado, depois rótulo que começa com o digitado, depois corredor, nível e posição. Sem busca a ordem continua sendo corredor, nível e posição. NUL e parâmetro repetido respondem 400.

## Listagem de lotes

`GET /lotes` (operador e administrador, paginado) aceita os filtros `id_produto`, `id_localizacao`, `status`, `numero_lote` (contém, sem diferenciar caixa) e `codigo_etiqueta` (casamento exato e com diferenciação de caixa, o que o leitor lê; espaços nas pontas são removidos como no cadastro; de 1 a 128 caracteres, sem NUL e uma única ocorrência, senão 400). Os filtros se combinam. Código sem lote devolve 200 com `dados: []` e `total: 0`. `GET /lotes`, `GET /lotes/:id` e a busca por etiqueta trazem também `validade_expirada` (booleano calculado no banco: `data_validade < current_date`; `false` sem validade), para a tela não depender do relógio do navegador; os `POST` não mudam. Uma consulta extra por página, sem consulta por lote. Cada lote traz `identificacao` (`id_identificacao`, `tipo_identificacao` e `codigo`, ou `null`). A busca usa o índice único `identificacao_codigo_key` (confirmado com EXPLAIN).

## Nomes nas listas (para o cliente não consultar item a item)

As leituras abaixo trazem, na própria resposta, o número do lote e o nome de quem agiu, para a interface não precisar de uma chamada por linha:

- `GET /movimentacoes` e `GET /movimentacoes/:id`: cada movimentação ganha `numero_lote` e `nome_usuario` (textos planos, ao lado de `id_lote` e `id_usuario`).
- `GET /inventario/contagens` e `GET /inventario/contagens/:id`: o mesmo, mantendo `divergencia`.
- `GET /auditoria`: cada registro ganha `nome_usuario`, que é `null` quando `id_usuario` é `null` (ação do sistema, como o agendador).

Só esses nomes são expostos: nunca e-mail nem `senha_hash`. As respostas dos `POST` (entrada, saída, transferência, ajuste, contagem, finalização e cancelamento) não mudam. O número de consultas é constante por página, sem consulta por linha: movimentações e contagens usam a contagem mais a página, mais uma leitura em lote dos lotes e outra dos usuários da página (relações do Prisma); a auditoria resolve o nome por subconsulta na lista de colunas, avaliada só para as linhas devolvidas, pela chave primária do usuário.

## Histórico de movimentações

`GET /movimentacoes` aceita os filtros `de`, `ate`, `tipo`, `id_lote` e `id_usuario`.

Formatos aceitos em `de` e `ate`, e somente estes:

- `AAAA-MM-DD`: dia inteiro em UTC. Em `de` vale desde 00:00:00 UTC; em `ate` inclui o dia todo (limite exclusivo às 00:00:00 UTC do dia seguinte).
- `AAAA-MM-DDThh:mm[:ss[.f]]` (fração de 1 a 3 casas) com `Z` ou deslocamento `+hh:mm` / `-hh:mm`. Em `de` o instante é incluído; em `ate` também (limite exclusivo 1 ms depois).

Outros formatos (semana ISO, dia do ano, `20261115`, horário sem fuso, `+hhmm`) respondem 400. A interpretação não depende do fuso do processo. `de` não pode ser posterior a `ate`.

Ordenação: `id_movimentacao` decrescente, a ordem de gravação. Dentro de cada lote ela é coerente com a ordem real das operações (o lote é travado antes de gravar e a data vem do relógio do banco depois da trava). Entre lotes diferentes não há garantia de ordem global de commit, e uma consulta não é um instantâneo: gravações concorrentes podem aparecer entre duas leituras.

Paginação: `pagina` e `limite` (padrão 20, máximo 100) usam deslocamento e `total` conta os registros do filtro. Se houver gravações enquanto o cliente percorre as páginas, o deslocamento repete linhas. Para percorrer o histórico sem repetir linhas e sem pular as que já eram visíveis, use o cursor: a resposta traz `proximo_antes_de_id` (o menor id da página, ou `null` quando não há mais) e a página seguinte é pedida com `?antes_de_id=<esse id>` (mantendo os demais filtros e usando sempre `pagina=1`, isto é, sem `pagina`). A paginação só por `pagina` (deslocamento) pode repetir ou pular linhas enquanto há gravações. Com `antes_de_id`, `total` conta só os registros restantes.

Limite da garantia do cursor: ela vale para os registros já visíveis (confirmados) quando a primeira página foi lida. Como o id é atribuído na gravação e a confirmação (commit) pode ocorrer depois, uma gravação tardia em outro lote pode receber um id menor que o cursor e só ficar visível depois que o cliente já passou por ele; ela não aparece nas páginas seguintes dessa varredura. Para ver tudo o que foi confirmado, recarregue a primeira página (sem `antes_de_id`).

## Auditoria (RF13)

`GET /auditoria`, somente leitura e só para administrador. Não existe rota de escrita. Filtros: `id_usuario`, `tabela` (`lote`, `movimentacao`, `usuario`), `operacao`, `ip`, `de` e `ate` (mesmas regras do histórico; consulta `data_hora >= início` e `< fim` para usar o B-tree), `valor_novo` e `valor_anterior`, mais `pagina`, `limite` (máximo 100) e o cursor `antes_de_id` / `proximo_antes_de_id` (mesmo contrato e mesmas limitações do histórico).

Decisões de projeto (a especificação não detalha):

- `operacao` aceita `INSERT`, `UPDATE` e `DELETE`, os valores que os triggers gravam. Ajuste e bloqueio se acham combinando `tabela` e conteúdo (por exemplo `tabela=lote&operacao=UPDATE&valor_novo={"status_lote":"bloqueado"}`).
- `valor_novo` e `valor_anterior` recebem um objeto JSON, aplicado com o operador `@>` (aproveita os índices GIN `jsonb_path_ops`). Limites: 512 caracteres, 3 níveis, 20 chaves, textos de até 100 caracteres, listas de até 10 itens; tipos contam (`{"id_lote":5}` casa número, `{"id_lote":"5"}` não). A chave `senha_hash` é recusada e removida das respostas.
- Os filtros por `id_usuario`, `tabela` e `ip` não têm índice próprio; combinados com período ou conteúdo o plano usa os índices existentes. Com o log atual (cerca de 130 mil linhas) uma consulta só por usuário e tabela leva cerca de 10 ms.

## Rastreabilidade do lote (RF14, RN18)

`GET /rastreabilidade?numero_lote=<número exato>` ou `?id_lote=<id>` (exatamente um dos dois), para operador e administrador. Devolve o lote (produto, localização atual e etiqueta) e `linha_do_tempo` com todas as movimentações em ordem cronológica (data e, no empate, id), cada uma com data, usuário, tipo, quantidade, saldos anterior e posterior, origem, destino e `status_movimentacao`.

Decisões de projeto: lote existente sem movimentações responde 200 com a linha do tempo vazia; lote inexistente responde 404; contagens de inventário entram na linha do tempo com o status explícito (`pendente`, `concluida` ou `cancelada`); como contagens não alteram saldo, a cadeia de saldos é formada só pelas movimentações concluídas que não são de inventário (os saldos de uma contagem são o instantâneo do momento da contagem). As leituras são feitas fora de transação, sem instantâneo único.

Paginação da linha do tempo (decisão de projeto): é paginada de verdade, sempre em ordem cronológica (data e, no empate, id). `limite` padrão 50 e máximo 100; use `pagina` (deslocamento) **ou** o cursor `depois_de_id` (id da última movimentação já lida; a página seguinte traz só as posteriores na ordem data/id e o cursor deve pertencer ao lote, senão 400), nunca os dois. A resposta traz `total` (todas as movimentações do lote), `pagina`, `limite` e `proximo_depois_de_id` (o último id da página quando ainda há mais, senão `null`); os dados do lote vêm em toda página. Novas movimentações gravadas durante a leitura entram no fim da ordem e não repetem nem pulam linhas já lidas pelo cursor.

## Dashboard (RF11, RN09)

`GET /dashboard`, para operador e administrador, com agregação no banco. A data de referência é sempre o `current_date` do banco (a mesma fonte dos alertas e do agendador), nunca o relógio ou o fuso do Node.

Indicadores (decisões de projeto; a especificação lista os seis nomes sem definir a conta): `produtos` = produtos ativos; `lotes` = lotes com status ativo e quantidade > 0; `vencidos` = lotes com status vencido; `bloqueados` = lotes com status bloqueado; `movimentacoes` = movimentações com status concluída gravadas no dia corrente do banco (todos os tipos, inclusive contagem de inventário concluída); `divergencias` = contagens de inventário pendentes cuja quantidade contada difere do saldo registrado na contagem. Os valores são contagens inteiras (números JSON).

`data_referencia`: o `current_date` do banco em `AAAA-MM-DD`. É o último dia da janela do gráfico; o cliente monta os 30 dias só a partir dele (a API devolve apenas dias com movimento, e o relógio ou o fuso do navegador não decidem a janela). É lido numa consulta própria, então em uma virada de dia exatamente entre as consultas o gráfico pode ter um dia a menos de diferença até a próxima atualização.

`grafico`: movimentações concluídas por dia e por tipo nos últimos 30 dias (hoje e os 29 anteriores), em uma consulta agregada: `[{ "dia": "AAAA-MM-DD", "tipo": "...", "total": n }]`.

`lotes_por_situacao`: contagem de lotes por situação (`ativo`, `bloqueado`, `vencido`) e `vencendo` (ativos com validade nos próximos 30 dias, subconjunto de `ativo`), em uma consulta agregada.

`saldo_por_categoria`: até 8 categorias, do maior para o menor, com `saldo_kg` = soma de `quantidade × peso_unitario_kg` dos lotes ativos (só produtos com peso unitário informado, porque as unidades de medida não são somáveis entre si); texto decimal.

`top_produtos`: os 5 produtos com mais movimentações concluídas de entrada e saída nos últimos 30 dias (mesma janela do gráfico), por `movimentacoes`, desempate pelo nome.

Todas as agregações são feitas no banco, somente leitura, sem consulta por item (sem N+1).

`alertas_estoque_minimo` (RN09): produto ativo cuja soma da quantidade dos lotes com status ativo é menor que o estoque mínimo (sem lote ativo a soma é 0), do maior déficit para o menor, até 100 itens, com `total` de produtos em alerta. Lotes bloqueados e vencidos não entram na soma.

## Alertas de vencimento e exportação (RF08, RN08)

`GET /alertas/vencimento` (operador e administrador, paginado como as demais listas) devolve os lotes com **status ativo** e `data_validade` entre hoje e hoje + 30 dias, inclusive. Lotes sem validade, vencidos e bloqueados ficam fora, e a quantidade não filtra (lote com saldo 0 aparece). "Hoje" é o `current_date` do banco, a mesma fonte do agendador. Ordem: validade e id.

`GET /alertas/vencimento/exportacao` (só administrador; operador recebe 403) devolve o mesmo conjunto, sem paginação, como CSV. Decisões de projeto: gerado sem biblioteca; UTF-8 com BOM, separador ponto e vírgula, linhas terminadas em CRLF; colunas número do lote, produto, validade, quantidade, unidade e localização (`corredor-nível-posição`); células com aspas, ponto e vírgula ou quebra de linha vão entre aspas, com aspas duplicadas; proteção contra fórmulas: célula iniciada por `=`, `+`, `-`, `@`, tabulação ou CR recebe um apóstrofo na frente; `Content-Type: text/csv; charset=utf-8` e `Content-Disposition: attachment`.

## Mapa do armazém (RF12)

`GET /mapa` (operador e administrador) devolve as localizações em ordem de corredor, nível e posição, cada uma com `capacidade` como está no banco (texto ou `null`) e a lista `lotes` armazenados nela (número, produto, unidade, quantidade e status); uma posição pode ter vários lotes. O número de consultas por página é constante (três, independente da quantidade de posições e de lotes): a página de localizações, a contagem de localizações do filtro (as duas em paralelo) e uma única consulta de lotes com função de janela para todas as posições da página. Não há consulta por posição (sem N+1).

Decisões de projeto: só entram lotes com quantidade maior que zero, de qualquer status (bloqueado e vencido ocupam espaço e aparecem com o status); **não há percentual de ocupação**, porque a unidade da capacidade não é definida; a resposta é paginada por localização (`pagina`, `limite` padrão 100 e máximo 100) e aceita o filtro `corredor`.

## Perfil e troca da própria senha

`GET /auth/me` devolve o usuário autenticado. `POST /auth/senha` (qualquer usuário autenticado) recebe `senha_atual` e `nova_senha` e responde 204. Regras (decisões de projeto): exige a senha atual (errada = 422 `SENHA_ATUAL_INCORRETA`, mensagem fixa); a nova senha tem no mínimo 8 caracteres e no máximo 72 bytes (limite do bcrypt) e não pode conter NUL (o mesmo validador do cadastro e da edição de usuário); o hash é bcrypt com custo 12 e a troca passa por `executarComoUsuario`, então é auditada (UPDATE em `usuario` com o próprio usuário e sem `senha_hash`). A rota tem limitador de tentativas em memória, igual ao do login (10 por 15 minutos por IP, contado antes do parser de JSON).

Limite conhecido: a troca de senha **não invalida os tokens já emitidos**. A especificação não pede isso e não há coluna para versionar sessões sem migração; cada token continua valendo até expirar (8 h) ou até o usuário ser inativado.

## Agendador diário (RN08, RNF05)

Marca como `vencido` o lote com status `ativo` e `data_validade < current_date`. Sem node-cron: temporizador nativo (`setInterval` de 24 h; executa uma vez logo depois da subida e depois a cada 24 h, sem sobreposição). Só roda quando `AGENDADOR_ATIVO=true` no ambiente (para uma única réplica; o padrão no `.env.example` é `false`). Não há rota HTTP de disparo.

Decisões de projeto: a referência de data é sempre o `current_date` do banco (a mesma fonte dos alertas de vencimento), nunca o relógio ou o fuso do Node (o fuso do banco será fixado na Etapa 4); no dia da validade o lote ainda não venceu, como na trigger; lote bloqueado continua bloqueado (o status é único e trocar apagaria o bloqueio); a ação é do sistema: transação própria com `app.user_id` e `app.ip` vazios, então a auditoria grava usuário e IP nulos (a seção 18 diz que ações do agendador não têm usuário), sem criar usuário técnico e sem herdar contexto de uma conexão do pool; cada lote é travado (`FOR UPDATE SKIP LOCKED`, lotes em uso ficam para a próxima execução) e só quem precisa é atualizado, então rodar duas vezes não gera log repetido; o processamento é em lotes de 500; uma falha escreve apenas `Agendador: falha na execução` e não derruba a API; o temporizador para no encerramento do processo, depois de esperar a execução em curso.

Teto da exportação (decisão de projeto): o CSV tem no máximo 10.000 linhas. O servidor confere por `COUNT` antes de ler as linhas e lê no máximo 10.001; acima do teto responde 422 `EXPORTACAO_MUITO_GRANDE` ("A exportação excede o limite de 10000 linhas. Reduza o conjunto de alertas e tente novamente"). Nunca trunca em silêncio. O documento é montado linha a linha, sem cópias intermediárias do conjunto.

Limite por posição (decisão de projeto): cada posição traz no máximo 50 lotes (ordenados por número e id) e `total_lotes` com o total de lotes com saldo da posição; para ver o restante, use `GET /lotes?id_localizacao=<id>` (a listagem de lotes já filtra por localização e é paginada).

## Cancelamento de contagem de inventário

`POST /inventario/contagens/:id/cancelar` (só administrador; operador recebe 403) cancela uma contagem de inventário pendente. Decisão de projeto: a especificação (RN07) só diz que um registro "pode ser marcado como cancelado"; aqui o cancelamento existe porque uma contagem que não pode ser finalizada (por exemplo, saldo final negativo) travaria novas contagens do lote. Regras: roda numa transação que trava o lote e depois a linha da contagem; só a transição `pendente` para `cancelada` é aceita; se o estado já mudou (contagem concluída, cancelada ou finalizada por outra requisição) a resposta é 409 `CONTAGEM_NAO_PENDENTE`; vale só para movimentações do tipo inventário (outro tipo ou id inexistente é 404); não altera saldo nem cria movimentação; o UPDATE de `status_movimentacao` é auditado pela trigger com o autor; depois do cancelamento o lote aceita nova contagem. Cancelar e finalizar ao mesmo tempo: só um vence, o outro recebe 409.
