# Regras de Negócio — StockFlow

Este documento registra somente regras observadas no código e nos scripts SQL.

## Produtos

- Produto possui `nome`, `categoria`, `unidade_medida`, `estoque_minimo`, `ativo`, `descricao` opcional e `sku_sap` quando o script complementar é aplicado.
- `nome`, `categoria` e `unidade_medida` são obrigatórios na criação.
- `estoque_minimo` deve ser maior ou igual a zero.
- Não é permitido criar produto com nome já cadastrado.
- Produto pode ser inativado por `PATCH /produtos/:id/inativar`.
- Inativação exige administrador e permissão de inativação.
- Listagem retorna estoque atual agregado a partir dos lotes.

## Lotes

- Lote possui `numero_lote` único.
- Lote pertence a um produto e uma localização.
- Quantidade não pode ser negativa no banco (`CHECK quantidade >= 0`).
- Status possível: `ativo`, `vencido`, `bloqueado`, `quarentena`, `finalizado`.
- Criação exige número do lote, produto e localização.
- Quantidade inicial é opcional e deve ser maior ou igual a zero.
- Bloqueio exige administrador e motivo com pelo menos 5 caracteres.
- Desbloqueio exige administrador.
- Lote bloqueado registra `data_bloqueio` e `motivo_bloqueio`.

## Entradas

- Endpoint: `POST /movimentacoes/entrada`.
- Exige lote válido e quantidade maior que zero.
- Requer permissão `movimentacoes.entrada`.
- Cria movimentação tipo `entrada`.
- Incrementa `lote.quantidade`.
- Usa transação MySQL.

## Saídas

- Endpoint: `POST /movimentacoes/saida`.
- Exige lote válido e quantidade maior que zero.
- Requer permissão `movimentacoes.saida`.
- Não permite saída de lote `bloqueado`.
- Não permite saída de lote `vencido`.
- Não permite saída com quantidade maior que a quantidade disponível.
- Cria movimentação tipo `saida`.
- Decrementa `lote.quantidade`.
- Usa transação MySQL.

## Transferências

- Endpoint: `POST /movimentacoes/transferencia`.
- Exige lote válido, localização destino válida e motivo com pelo menos 10 caracteres.
- Requer permissão `movimentacoes.transferencia`.
- Não permite transferência de lote `bloqueado`.
- Não permite transferência de lote `vencido`.
- Cria movimentação tipo `transferencia`.
- Atualiza `lote.id_localizacao`.
- Usa transação MySQL.

## Ajustes

- Endpoint: `POST /movimentacoes/ajuste`.
- Exige administrador.
- Requer permissão `movimentacoes.ajuste`.
- Exige lote válido, nova quantidade maior ou igual a zero e justificativa com pelo menos 10 caracteres.
- Não permite ajuste sem diferença real entre quantidade atual e nova quantidade.
- Cria movimentação tipo `ajuste` com quantidade igual ao valor absoluto da diferença.
- Atualiza `lote.quantidade` para a nova quantidade.
- Usa transação MySQL.

## RFID e QR Code

- Tabela: `identificacao`.
- Tipos permitidos: `QR Code` e `RFID`.
- `codigo` é único.
- `id_lote` é único; um lote tem no máximo uma identificação.
- A criação exige tipo, código e lote válido.
- Não permite cadastrar identificação para lote inexistente.
- Não permite reaproveitar código já cadastrado.

## Rastreabilidade

- Timeline de lote: `GET /lotes/:id/timeline`.
- Busca por identificação: `GET /identificacoes/:codigo`.
- A timeline vem da tabela `movimentacao`, associada a usuário e localizações de origem/destino.
- Rastreabilidade depende do vínculo entre `lote`, `movimentacao`, `usuario`, `localizacao` e `identificacao`.

## FEFO

Não há regra FEFO obrigatória implementada nas rotas de saída. O sistema expõe dados de validade e alertas, mas o endpoint de saída recebe `id_lote` e não seleciona automaticamente o lote com validade mais próxima.

## Estoque Mínimo

- Produto possui `estoque_minimo`.
- Alertas de abaixo do mínimo são calculados por agregação de quantidade dos lotes ativos por produto.
- Endpoint específico: `GET /lotes/abaixo-minimo`.
- Dashboard também calcula alertas e saúde do estoque.

## Bloqueios

- Bloqueio de lote é administrativo.
- Lote bloqueado impede saída e transferência.
- Bloqueio gera auditoria.
- Desbloqueio redefine status para `ativo` e limpa motivo/data.

## Quarentena

O status `quarentena` existe no enum de `lote.status_lote`, mas não há fluxo específico observado no frontend/API para colocar lote em quarentena. Deve ser tratado como status modelado, não como funcionalidade operacional completa.

## Alertas

Alertas reais observados:

- Lotes vencendo em até 30 dias.
- Produtos/lotes abaixo do estoque mínimo.
- Lotes bloqueados.
- Alertas pendentes no dashboard.

## Health Score

O dashboard possui endpoint `GET /dashboard/saude-estoque`, que calcula indicadores agregados de saúde do estoque com base em validade e situação dos lotes. A regra é analítica e não altera dados.

## Auditoria

- Tabela: `auditoria_log`.
- Operações permitidas no enum: `INSERT`, `UPDATE`, `DELETE`, `LOGIN`, `AJUSTE`, `BLOQUEIO`.
- A aplicação registra auditoria via `logAudit`.
- O banco registra auditoria por triggers em movimentação, lote e usuário.
- Não há rotas de atualização ou exclusão de auditoria.

## Usuários e Permissões

- Perfis: `administrador` e `operador`.
- Login exige usuário ativo.
- Senhas são validadas com bcrypt.
- Administrador tem acesso total por `checkPermission`.
- Operador usa permissões padrão e pode ter permissões JSON customizadas.
- Gestão de usuários exige administrador.
