# Módulos do StockFlow

## Dashboard

Objetivo: apresentar visão operacional do estoque.

Funcionalidades:

- KPIs.
- Movimentações por período.
- Alertas.
- Ocupação por corredor.
- Top produtos.
- Saúde do estoque.
- Rupturas.
- Curva ABC.
- Distribuição por categoria.

Fluxo:

1. Usuário acessa `/dashboard`.
2. Frontend carrega múltiplos endpoints do dashboard.
3. Dados são exibidos em cards, listas e visualizações.

Dependências:

- API `/dashboard/*`.
- API `/movimentacoes`.

APIs utilizadas:

- `/dashboard/kpis`
- `/dashboard/movimentacoes`
- `/dashboard/alertas`
- `/dashboard/alertas-pendentes`
- `/dashboard/ocupacao-corredores`
- `/dashboard/top-produtos`
- `/dashboard/saude-estoque`
- `/dashboard/rupturas`
- `/dashboard/curva-abc`
- `/dashboard/distribuicao-categoria`
- `/movimentacoes`

## Produtos

Objetivo: manter cadastro de produtos e estoque mínimo.

Funcionalidades:

- Listagem.
- Busca/filtros no frontend.
- Criação.
- Atualização.
- Inativação.
- Exibição de estoque atual agregado.

Fluxo:

1. Usuário acessa `/produtos`.
2. Frontend busca `/produtos`.
3. Operador cria/edita quando permitido.

Dependências:

- Tabela `produto`.
- Lotes para estoque agregado.

APIs utilizadas:

- `GET /produtos`
- `GET /produtos/:id`
- `POST /produtos`
- `PUT /produtos/:id`
- `PATCH /produtos/:id/inativar`

## Lotes

Objetivo: controlar unidades rastreáveis de estoque.

Funcionalidades:

- Listagem.
- Cadastro.
- Atualização.
- Bloqueio/desbloqueio.
- Consulta de timeline.
- Alertas de vencimento e estoque mínimo.

Fluxo:

1. Usuário consulta lotes em `/lotes`.
2. API retorna lote com produto/localização/identificação.
3. Ações administrativas podem bloquear/desbloquear.

Dependências:

- `produto`.
- `localizacao`.
- `movimentacao`.
- `identificacao`.

APIs utilizadas:

- `GET /lotes`
- `GET /lotes/:id`
- `GET /lotes/:id/timeline`
- `GET /lotes/vencendo`
- `GET /lotes/abaixo-minimo`
- `POST /lotes`
- `PUT /lotes/:id`
- `PATCH /lotes/:id/bloquear`
- `PATCH /lotes/:id/desbloquear`

## Entradas

Objetivo: registrar aumento de estoque em lote.

Funcionalidades:

- Seleção de lote.
- Registro de quantidade.
- Histórico de entradas.
- Timeline do lote.

Fluxo:

1. Operador seleciona lote e quantidade.
2. API valida lote e permissão.
3. Transação insere movimentação e incrementa estoque.

Dependências:

- `lote`.
- `movimentacao`.
- `usuario`.

API utilizada:

- `POST /movimentacoes/entrada`
- `GET /movimentacoes`
- `GET /lotes`
- `GET /lotes/:id/timeline`

## Saídas

Objetivo: registrar retirada de estoque.

Funcionalidades:

- Seleção de lote.
- Validação de estoque disponível.
- Bloqueio de lote vencido/bloqueado.
- Histórico e timeline.

Fluxo:

1. Operador informa lote e quantidade.
2. API valida disponibilidade e status.
3. Transação insere movimentação e decrementa estoque.

APIs utilizadas:

- `POST /movimentacoes/saida`
- `GET /movimentacoes`
- `GET /lotes`
- `GET /lotes/:id/timeline`

## Transferências

Objetivo: mover lote entre localizações.

Funcionalidades:

- Seleção de lote.
- Seleção de destino.
- Registro de motivo.
- Histórico.

Fluxo:

1. Operador escolhe lote e localização destino.
2. API valida status e destino.
3. Transação insere movimentação e atualiza localização do lote.

APIs utilizadas:

- `POST /movimentacoes/transferencia`
- `GET /movimentacoes`
- `GET /lotes`
- `GET /localizacoes`
- `GET /lotes/:id/timeline`

## Mapa do Armazém

Objetivo: visualizar ocupação das posições físicas.

Funcionalidades:

- Carrega localizações.
- Carrega lotes.
- Exibe posição, ocupação e detalhes.

Fluxo:

1. Usuário acessa `/mapa`.
2. Frontend busca localizações e lotes.
3. Interface monta visão de ocupação.

APIs utilizadas:

- `GET /localizacoes`
- `GET /lotes`
- `GET /lotes/:id`

## Rastreabilidade

Objetivo: localizar lote e exibir histórico.

Funcionalidades:

- Busca por lote.
- Timeline de movimentações.
- Consulta por identificação em API dedicada.

Fluxo:

1. Usuário pesquisa lote/código.
2. Frontend identifica lote.
3. API retorna timeline.

APIs utilizadas:

- `GET /lotes`
- `GET /lotes/:id/timeline`
- `GET /identificacoes/:codigo`

## Usuários

Objetivo: gerenciar acesso ao sistema.

Funcionalidades:

- Listagem.
- Criação.
- Edição.
- Inativação.
- Permissões customizadas para operadores.

Fluxo:

1. Administrador acessa `/usuarios`.
2. API valida admin e permissões.
3. Alterações são salvas e auditadas.

APIs utilizadas:

- `GET /usuarios`
- `GET /usuarios/:id`
- `POST /usuarios`
- `PUT /usuarios/:id`
- `PATCH /usuarios/:id/inativar`
- `GET /usuarios/perfil`

## Alertas

Objetivo: destacar lotes em risco operacional.

Funcionalidades:

- Lotes vencendo.
- Bloqueio de lote pelo administrador.
- Alertas no layout/dashboard.

Fluxo:

1. Frontend consulta lotes vencendo.
2. Usuário avalia risco.
3. Administrador pode bloquear lote.

APIs utilizadas:

- `GET /lotes/vencendo`
- `PATCH /lotes/:id/bloquear`
- `GET /dashboard/alertas`
- `GET /dashboard/alertas-pendentes`

## Inventário

Objetivo: registrar contagem rotativa e divergências.

Funcionalidades:

- Listagem.
- Criação por corredor.
- Contagem de itens.
- Confirmação.
- Finalização com ajuste de divergências.

Dependência crítica:

- Requer tabela `inventario`, que não é criada por `database/setup.sql`.

APIs utilizadas:

- `GET /inventario`
- `POST /inventario`
- `GET /inventario/:id`
- `PATCH /inventario/:id/contar`
- `PATCH /inventario/:id/confirmar`
- `PATCH /inventario/:id/finalizar`
- `GET /inventarios`

## Integração SAP

Objetivo: importar produtos por payload JSON no formato SAP simplificado.

Funcionalidades:

- Importação direta de produtos.
- Importação de arquivo JSON no frontend.
- Atualização por nome ou `sku_sap`.

APIs utilizadas:

- `POST /sap/importar-produtos`
- `POST /sap/importar-json`
