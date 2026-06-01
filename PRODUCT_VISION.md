# Product Vision — StockFlow

## Problema Resolvido

Empresas com estoque físico e produtos rastreáveis precisam controlar lote, validade, localização e responsável por movimentação. Quando esse controle é feito por planilhas ou registros desconectados, surgem riscos operacionais:

- Perda de rastreabilidade em recalls.
- Desperdício por vencimento.
- Estoque divergente entre sistema e armazém.
- Falta de evidência para auditoria.
- Decisões com dados atrasados.

## Público-alvo

- Empresas com produtos perecíveis ou controlados por lote.
- Operações de armazenagem, produção e expedição.
- Indústrias alimentícias, distribuidoras e operações que exigem controle de validade.
- Equipes com operadores e administradores responsáveis por estoque.

## Proposta de Valor

StockFlow entrega uma operação web centralizada para registrar, consultar e auditar o ciclo de vida de produtos em estoque.

Valor entregue:

- Controle por lote.
- Localização física por corredor, nível e posição.
- Histórico de movimentações.
- Alertas de validade e estoque mínimo.
- Auditoria técnica das operações.
- Busca e rastreabilidade por identificação QR Code/RFID.
- Dashboard operacional para tomada de decisão.

## Diferenciais Existentes

- API com SQL direto e transações explícitas nas movimentações.
- Triggers de auditoria no banco.
- Auditoria também em camada de aplicação.
- Permissões por perfil e permissões customizadas.
- Mapa do armazém no frontend.
- Integração SAP por importação JSON de produtos.
- Design system próprio para interface operacional.

## Casos de Uso

### Recebimento ou Produção

O operador registra entrada em um lote existente ou acompanha lote cadastrado. O estoque é atualizado e a movimentação fica registrada.

### Separação e Saída

O operador seleciona o lote, informa quantidade e registra saída. O sistema valida estoque disponível e bloqueia saída de lotes vencidos ou bloqueados.

### Transferência Interna

O operador move um lote entre localizações físicas. A quantidade permanece igual e a localização do lote é atualizada.

### Bloqueio de Lote

Administrador bloqueia um lote com motivo. Lotes bloqueados não podem sair nem ser transferidos.

### Inventário Rotativo

O operador inicia inventário por corredor, conta itens e finaliza divergências, quando a estrutura de banco de inventário está disponível.

### Rastreabilidade

Usuário busca por lote ou código e consulta a timeline de movimentações.

## Benefícios

- Reduz divergências operacionais.
- Aumenta velocidade de consulta.
- Melhora controle de validade.
- Apoia auditoria e conformidade.
- Facilita investigação por lote.
- Centraliza dados de estoque, movimentação e usuário.

## Roadmap

Itens baseados em pendências reais e evolução natural do código:

- Corrigir schema principal para contemplar `inventario`.
- Revisar dependência `xlsx`.
- Adicionar testes automatizados.
- Persistir blacklist de JWT.
- Melhorar contratos e documentação OpenAPI.
- Evoluir deploy por ambiente.
- Ampliar relatórios e exportações de forma segura.

## Posicionamento de Mercado

StockFlow se posiciona como WMS acadêmico/profissional para operações que precisam de rastreabilidade por lote, foco em validade e controle de armazém. Não pretende substituir ERPs completos; atua como camada operacional de estoque e rastreabilidade, com integração SAP de produtos por JSON.
