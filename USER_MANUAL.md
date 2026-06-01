# Manual do Usuário — StockFlow

Este manual resume o uso operacional das telas reais do StockFlow. O manual histórico também existe em `docs/MANUAL_USUARIO.md`.

## Login

1. Acesse o frontend.
2. Informe e-mail ou código de usuário.
3. Informe a senha.
4. Clique para entrar.

Se o login for válido, o sistema salva a sessão no navegador e abre o dashboard.

## Dashboard

Use o dashboard para acompanhar:

- KPIs gerais.
- Alertas.
- Movimentações recentes.
- Ocupação do armazém.
- Produtos mais movimentados.
- Indicadores de saúde do estoque.
- Risco de ruptura e curva ABC.

Passos:

1. Acesse `/dashboard`.
2. Revise os cards principais.
3. Use filtros de período quando disponíveis.
4. Clique nos itens relevantes para investigar módulos relacionados.

## Produtos

Objetivo: cadastrar e consultar produtos.

Passos gerais:

1. Acesse `/produtos`.
2. Use busca ou filtros para localizar produto.
3. Cadastre produto informando nome, categoria, unidade e estoque mínimo.
4. Edite dados quando necessário.
5. Inative produto apenas se tiver permissão administrativa.

## Lotes

Objetivo: controlar unidades rastreáveis.

Passos:

1. Acesse `/lotes`.
2. Consulte por número de lote, produto ou status.
3. Cadastre lote com produto, localização, quantidade e validade.
4. Abra detalhes/timeline para ver histórico.
5. Administradores podem bloquear ou desbloquear lotes.

## Entradas

Objetivo: aumentar estoque de um lote.

Passos:

1. Acesse `/entrada`.
2. Selecione o lote.
3. Informe quantidade.
4. Informe observação, se necessário.
5. Confirme.

O sistema registra movimentação tipo `entrada` e incrementa a quantidade do lote.

## Saídas

Objetivo: retirar estoque.

Passos:

1. Acesse `/saida`.
2. Selecione o lote.
3. Informe quantidade.
4. Confirme.

O sistema bloqueia saída quando:

- lote não existe;
- lote está bloqueado;
- lote está vencido;
- quantidade solicitada é maior que a disponível.

## Transferências

Objetivo: mover lote para outra localização.

Passos:

1. Acesse `/transferencia`.
2. Selecione lote.
3. Selecione localização destino.
4. Informe motivo com pelo menos 10 caracteres.
5. Confirme.

O sistema registra movimentação e atualiza a localização atual do lote.

## Mapa do Armazém

Objetivo: visualizar posições físicas e ocupação.

Passos:

1. Acesse `/mapa`.
2. Analise corredores, níveis e posições.
3. Selecione uma posição/lote para consultar detalhes.

## RFID e QR Code

Objetivo: identificar lotes por código.

Uso operacional:

1. Cadastre uma identificação em um lote usando tipo `QR Code` ou `RFID`.
2. Use o código para buscar o lote.
3. Consulte a timeline para rastrear movimentações.

Regras:

- Um código pertence a um único lote.
- Um lote tem no máximo uma identificação.

## Rastreabilidade

Objetivo: consultar histórico de um lote.

Passos:

1. Acesse `/rastreabilidade`.
2. Pesquise por lote ou código.
3. Abra a timeline.
4. Analise entradas, saídas, transferências, ajustes e inventários.

## Alertas de Vencimento

Objetivo: acompanhar lotes com risco por validade.

Passos:

1. Acesse `/alertas` ou `/alertas-vencimento`.
2. Revise lotes vencendo.
3. Administradores podem bloquear lote quando necessário.

## Inventário

Objetivo: conferir estoque físico por corredor.

Passos:

1. Acesse `/inventario`.
2. Crie inventário por corredor.
3. Conte os lotes listados.
4. Confirme a contagem.
5. Finalize para registrar divergências.

Observação: o módulo depende da tabela `inventario`, que não é criada pelo `database/setup.sql` atual.

## Relatórios

Objetivo: consultar dados operacionais consolidados.

Passos:

1. Acesse `/relatorios`.
2. Escolha o tipo de relatório.
3. Gere a visualização.
4. Exporte quando a opção estiver disponível.

## Usuários

Tela administrativa.

Passos:

1. Acesse `/usuarios`.
2. Cadastre usuário.
3. Defina perfil.
4. Ajuste permissões customizadas quando aplicável.
5. Inative usuários que não devem acessar o sistema.

## Auditoria

Tela administrativa.

Uso:

1. Acesse `/auditoria`.
2. Filtre por operação, tabela, usuário ou termo.
3. Consulte logs.

Os registros são somente leitura.

## Integração SAP

Tela administrativa.

Uso:

1. Acesse `/sap`.
2. Envie dados JSON de produtos.
3. O sistema importa ou atualiza produtos por nome ou `sku_sap`.

Campos reconhecidos:

- `MAKTX`: nome.
- `MATNR`: SKU SAP.
- `MATKL`: categoria.
- `MEINS`: unidade.
- `MINBE`: estoque mínimo.
