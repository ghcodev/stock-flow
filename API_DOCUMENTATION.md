# API Documentation — StockFlow

Base URL local: `http://localhost:3000/api/v1`.

Autenticação padrão: `Authorization: Bearer <token>`.

Formato de erro comum:

```json
{
  "error": "Mensagem do erro",
  "timestamp": "2026-05-31T00:00:00.000Z"
}
```

## Health

### GET `/health`

Autenticação: não.

Resposta:

```json
{
  "status": "ok",
  "timestamp": "2026-05-31T00:00:00.000Z"
}
```

## Auth

### GET `/auth/usuario-por-codigo/:codigo`

Autenticação: não.

Busca usuário ativo por ID numérico.

Resposta:

```json
{ "encontrado": true, "nome": "Nome do usuário" }
```

ou:

```json
{ "encontrado": false }
```

### POST `/auth/login`

Autenticação: não. Usa `loginLimiter`.

Request:

```json
{
  "identifier": "admin@empresa.com",
  "senha": "senha"
}
```

Resposta:

```json
{
  "token": "jwt",
  "usuario": {
    "id": 1,
    "nome": "Usuário",
    "email": "usuario@empresa.com",
    "perfil": "administrador",
    "permissoes": null
  }
}
```

Erros: 400 validação, 401 credenciais inválidas.

### GET `/auth/perfil`

Autenticação: sim.

Resposta:

```json
{ "usuario": { "id": 1, "email": "usuario@empresa.com", "perfil": "administrador" } }
```

### POST `/auth/logout`

Autenticação: sim.

Resposta:

```json
{ "mensagem": "Logout realizado com sucesso" }
```

### PATCH `/auth/senha`

Autenticação: sim.

Request:

```json
{
  "senha_atual": "senha atual",
  "nova_senha": "nova senha"
}
```

Resposta:

```json
{ "mensagem": "Senha alterada com sucesso" }
```

Erros: 400, 401, 404.

## Produtos

Todas as rotas exigem JWT.

### GET `/produtos`

Permissão: `produtos.ver`.

Query real usada: `search`/`busca`, `categoria`, `page`, `limit`.

Resposta:

```json
{
  "data": [],
  "total": 0,
  "page": 1,
  "limit": 20
}
```

### GET `/produtos/:id`

Permissão: `produtos.ver`.

Resposta: produto com `estoque_atual`.

Erros: 404.

### POST `/produtos`

Permissão: `produtos.criar`.

Request:

```json
{
  "nome": "Produto",
  "categoria": "Categoria",
  "unidade_medida": "unidade",
  "descricao": "Opcional",
  "estoque_minimo": 10
}
```

Resposta: 201 com `id`, `nome`, `categoria`, `unidade_medida`, `estoque_minimo`.

Erros: 400, 409.

### PUT `/produtos/:id`

Permissão: `produtos.editar`.

Request: campos de produto.

Resposta:

```json
{ "mensagem": "Produto atualizado" }
```

Erros: 400, 404.

### PATCH `/produtos/:id/inativar`

Autenticação: admin + `produtos.inativar`.

Resposta:

```json
{ "mensagem": "Produto inativado" }
```

## Lotes

Todas as rotas exigem JWT.

### GET `/lotes/vencendo`

Lista lotes ativos com validade até 30 dias.

### GET `/lotes/abaixo-minimo`

Lista produtos com estoque agregado abaixo do mínimo.

### GET `/lotes`

Query: `search`, `status`, `produto`, `page`, `limit`.

Resposta paginada:

```json
{ "data": [], "total": 0, "page": 1, "limit": 20 }
```

### GET `/lotes/:id`

Retorna lote com produto, localização e identificação.

Erros: 404.

### GET `/lotes/:id/timeline`

Retorna movimentações do lote com usuário e localizações.

### POST `/lotes`

Request:

```json
{
  "numero_lote": "LOT-001",
  "id_produto": 1,
  "id_localizacao": 1,
  "quantidade": 100,
  "data_fabricacao": "2026-05-31",
  "data_validade": "2026-06-30"
}
```

Resposta: 201 com `id` e `numero_lote`.

Erros: 400, 409.

### PUT `/lotes/:id`

Atualiza número, datas e localização.

Resposta:

```json
{ "mensagem": "Lote atualizado" }
```

### PATCH `/lotes/:id/bloquear`

Autenticação: admin.

Request:

```json
{ "motivo": "Motivo do bloqueio" }
```

Resposta:

```json
{ "mensagem": "Lote bloqueado" }
```

### PATCH `/lotes/:id/desbloquear`

Autenticação: admin.

Resposta:

```json
{ "mensagem": "Lote desbloqueado" }
```

## Movimentações

Todas as rotas exigem JWT.

### GET `/movimentacoes`

Query: `tipo`, `lote`, `usuario`, `search`, `page`, `limit`, `order`.

Resposta paginada:

```json
{ "data": [], "total": 0, "page": 1, "limit": 20 }
```

### POST `/movimentacoes/entrada`

Permissão: `movimentacoes.entrada`.

Request:

```json
{
  "id_lote": 1,
  "quantidade": 10,
  "id_localizacao_destino": 1,
  "observacao": "Entrada"
}
```

Resposta: 201.

### POST `/movimentacoes/saida`

Permissão: `movimentacoes.saida`.

Request:

```json
{
  "id_lote": 1,
  "quantidade": 5,
  "observacao": "Saída"
}
```

Erros: lote não encontrado, lote bloqueado/vencido, estoque insuficiente.

### POST `/movimentacoes/transferencia`

Permissão: `movimentacoes.transferencia`.

Request:

```json
{
  "id_lote": 1,
  "id_localizacao_destino": 2,
  "motivo_movimentacao": "Reorganização do armazém"
}
```

### POST `/movimentacoes/ajuste`

Autenticação: admin + `movimentacoes.ajuste`.

Request:

```json
{
  "id_lote": 1,
  "nova_quantidade": 12,
  "justificativa": "Correção após conferência"
}
```

### POST `/movimentacoes/inventario`

Compara contagens com quantidade do sistema.

Request:

```json
{
  "contagens": [
    { "id_lote": 1, "quantidade_contada": 10 }
  ]
}
```

Resposta:

```json
{
  "divergencias": [],
  "total_contado": 1,
  "total_divergencias": 0
}
```

## Localizações

### GET `/localizacoes`

Autenticação: sim.

Resposta: lista de localizações.

### GET `/localizacoes/:id/lotes`

Autenticação: sim.

Resposta: lotes de uma localização.

### POST `/localizacoes`

Autenticação: admin.

Request:

```json
{
  "corredor": "A",
  "nivel": 1,
  "posicao": 1,
  "descricao": "Opcional"
}
```

## Usuários

### GET `/usuarios/perfil`

Autenticação: sim.

Retorna perfil do usuário autenticado.

### GET `/usuarios`

Autenticação: admin + `usuarios.ver`.

### GET `/usuarios/:id`

Autenticação: admin + `usuarios.ver`.

### POST `/usuarios`

Autenticação: admin + `usuarios.criar`.

Request:

```json
{
  "nome": "Usuário",
  "email": "usuario@empresa.com",
  "senha": "123456",
  "perfil": "operador"
}
```

### PUT `/usuarios/:id`

Autenticação: admin.

Permite atualizar nome, e-mail, perfil e permissões.

### PATCH `/usuarios/:id/inativar`

Autenticação: admin.

## Identificações

### GET `/identificacoes/:codigo`

Autenticação: sim.

Busca lote por código QR/RFID.

Erros: 404.

### POST `/identificacoes`

Autenticação: sim.

Request:

```json
{
  "tipo": "RFID",
  "codigo": "RFID-001",
  "id_lote": 1
}
```

Erros: 400, 404, 409.

## Auditoria

Todas exigem admin + `auditoria.ver`.

### GET `/auditoria`

Query: `operacao`, `tabela`, `usuario`, `search`, `page`, `limit`.

### GET `/auditoria/lote/:id`

Busca logs relacionados a lote.

### GET `/auditoria/usuario/:id`

Retorna até 200 logs de um usuário.

## Dashboard

Todas exigem JWT.

### GET `/dashboard/kpis`

Query opcional: `periodo`.

Retorna KPIs operacionais.

### GET `/dashboard/movimentacoes`

Retorna movimentações agregadas por período.

### GET `/dashboard/alertas`

Retorna alertas de vencimento, estoque mínimo e bloqueios.

### GET `/dashboard/alertas-pendentes`

Retorna itens pendentes para ação.

### GET `/dashboard/ocupacao-corredores`

Retorna ocupação por corredor.

### GET `/dashboard/top-produtos`

Query: `periodo`.

Retorna produtos mais movimentados.

### GET `/dashboard/operadores-hoje`

Retorna operadores com movimentações no dia.

### GET `/dashboard/saude-estoque`

Retorna indicadores agregados de saúde do estoque.

### GET `/dashboard/rupturas`

Retorna risco de ruptura baseado em estoque e média de saída.

### GET `/dashboard/curva-abc`

Retorna classificação ABC baseada em movimentações.

### GET `/dashboard/distribuicao-categoria`

Query opcional: `periodo`.

Retorna distribuição por categoria.

## Inventários

Há duas APIs reais.

### GET `/inventarios`

Autenticação: sim.

Lista registros da tabela `inventario`. Depende da existência dessa tabela no banco.

### POST `/inventarios`

Autenticação: sim.

Request:

```json
{
  "corredor": "A",
  "observacao": "Opcional"
}
```

Resposta: 201 com ID e mensagem.

### GET `/inventario`

Autenticação: sim.

Lista inventários com campos de etapa, totais e usuário.

### POST `/inventario`

Autenticação: sim.

Request:

```json
{
  "corredor": "A",
  "id_usuario": 1
}
```

Cria inventário com itens baseados em lotes ativos do corredor.

### GET `/inventario/:id`

Retorna inventário detalhado.

### PATCH `/inventario/:id/contar`

Request:

```json
{
  "id_lote": 1,
  "qtd_contada": 10
}
```

Atualiza item contado.

### PATCH `/inventario/:id/confirmar`

Confirma inventário após todos os itens serem contados.

### PATCH `/inventario/:id/finalizar`

Finaliza inventário confirmado, cria movimentações tipo `inventario` para divergências e atualiza quantidades de lote.

## SAP

Todas exigem JWT e permissão `sap.importar`.

### POST `/sap/importar-produtos`

Aceita array ou objeto com `produtos`/`data`.

Campos SAP usados:

- `MAKTX`: nome obrigatório.
- `MATNR`: SKU SAP opcional.
- `MATKL`: categoria.
- `MEINS`: unidade.
- `MINBE`: estoque mínimo.

Resposta:

```json
{
  "importados": 1,
  "atualizados": 0,
  "erros": 0,
  "detalhes": []
}
```

### POST `/sap/importar-json`

Mesmo contrato de `/sap/importar-produtos`, com erro específico para JSON sem produtos válidos.
