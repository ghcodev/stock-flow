# Manual do Usuário — StockFlow

**Versão:** 1.3  
**Data:** Maio 2026  
**Sistema:** StockFlow — Controle de Estoque com Rastreabilidade Total

---

## Sumário

1. [Introdução](#1-introdução)
2. [Acesso ao Sistema](#2-acesso-ao-sistema)
3. [Dashboard](#3-dashboard)
4. [Entrada de Produtos](#4-entrada-de-produtos)
5. [Saída de Produtos](#5-saída-de-produtos)
6. [Transferência entre Localizações](#6-transferência-entre-localizações)
7. [Lotes](#7-lotes)
8. [Produtos](#8-produtos)
9. [Localizações](#9-localizações)
10. [Usuários](#10-usuários)
11. [Inventário](#11-inventário)
12. [Auditoria](#12-auditoria)
13. [Mapa do Armazém](#13-mapa-do-armazém)
14. [Relatórios](#14-relatórios)
15. [Identificações (RFID/QR)](#15-identificações-rfidqr)
16. [Perguntas Frequentes](#16-perguntas-frequentes)

---

## 1. Introdução

O **StockFlow** é um sistema de controle de estoque projetado para operações que exigem rastreabilidade completa de produtos por lote, localização e movimentação. Desenvolvido para a indústria alimentícia, o sistema garante conformidade com boas práticas de armazenamento (FIFO/FEFO) e fornece visibilidade em tempo real do inventário.

### Funcionalidades principais

| Funcionalidade | Descrição |
|---|---|
| Rastreabilidade por lote | Todo produto é identificado por lote com data de fabricação e validade |
| Controle de localização | Estoque organizado por corredor, nível e posição |
| Movimentações auditadas | Entrada, saída, transferência e ajuste registram usuário, data e motivo |
| Inventário cíclico | Conferência por corredor com cálculo de acurácia automático |
| Dashboard em tempo real | KPIs, gráficos de movimentação e alertas de validade |
| Mapa do armazém | Visualização visual da ocupação de cada posição |
| Identificação RFID/QR | Rastreio por código de identificação físico |

### Perfis de acesso

| Perfil | Permissões |
|---|---|
| **Admin** | Acesso total — cadastros, movimentações, usuários, relatórios |
| **Operador** | Movimentações, consulta de estoque e lotes |
| **Auditor** | Leitura apenas — relatórios e auditoria |

---

## 2. Acesso ao Sistema

### Login

1. Abra o navegador e acesse `http://localhost:5173`
2. Você será redirecionado para a tela de login
3. Informe seu **e-mail** e **senha**
4. Clique em **Entrar**

**Credenciais padrão (ambiente de desenvolvimento):**

```
E-mail: admin@stockflow.com
Senha:  Admin@1234
```

> **Atenção:** Altere a senha padrão antes de usar em produção.

### Primeiro acesso

Ao fazer login pela primeira vez, recomendamos:
1. Ir em **Usuários** e atualizar sua senha (mínimo 6 caracteres)
2. Verificar se os **Produtos** e **Localizações** estão cadastrados
3. Conferir o **Dashboard** para o estado atual do estoque

### Logout

Clique no ícone de usuário no canto superior direito e selecione **Sair**. O token de sessão é invalidado imediatamente no servidor.

### Alterar senha

1. Acesse o menu de perfil (ícone de usuário)
2. Clique em **Alterar Senha**
3. Informe a senha atual e a nova senha (mínimo 6 caracteres)
4. Clique em **Salvar**

---

## 3. Dashboard

O Dashboard é a tela inicial do sistema e apresenta uma visão consolidada do estado atual do estoque.

### KPIs (Indicadores principais)

| Indicador | O que mostra |
|---|---|
| **Total de Lotes Ativos** | Quantidade de lotes em estoque com saldo > 0 |
| **Produtos com Estoque Baixo** | Lotes abaixo do mínimo definido ou com poucas unidades |
| **Lotes Vencidos** | Lotes cuja data de validade já passou |
| **Lotes a Vencer (7 dias)** | Lotes que vencem nos próximos 7 dias |
| **Acurácia do Inventário** | Percentual médio de acurácia dos últimos inventários |
| **Movimentações Hoje** | Total de movimentações registradas no dia |

### Gráfico de Movimentações

Exibe as entradas e saídas dos últimos 30 dias em formato de barras. Passe o mouse sobre as barras para ver os valores exatos.

- **Barras azuis:** Entradas
- **Barras vermelhas:** Saídas

### Alertas de Validade

Lista os lotes que estão próximos do vencimento ou já vencidos, ordenados pela data de validade. Clique em um lote para ver seus detalhes.

### Estoque por Produto

Tabela resumida com o saldo atual de cada produto, agrupando todos os lotes ativos.

---

## 4. Entrada de Produtos

Registra a chegada de produtos no estoque, criando ou incrementando lotes.

### Como registrar uma entrada

1. Acesse **Entrada** no menu lateral
2. Clique em **Nova Entrada**
3. Preencha os campos:

| Campo | Obrigatório | Descrição |
|---|---|---|
| Produto | Sim | Selecione o produto na lista |
| Número do Lote | Sim | Código do lote (ex: `LT-2026-001`) |
| Quantidade | Sim | Quantidade que está entrando |
| Data de Fabricação | Sim | Data em que o produto foi fabricado |
| Data de Validade | Sim | Data de vencimento do produto |
| Localização | Sim | Corredor/Nível/Posição de armazenamento |
| Fornecedor | Não | Nome do fornecedor |
| Custo Unitário | Não | Preço de custo por unidade |
| Observação | Não | Notas adicionais |

4. Clique em **Salvar**

> **Importante:** Se o número do lote já existir no sistema, a quantidade será somada ao lote existente (sem criar duplicata).

### Consultar entradas registradas

A tabela principal da tela Entrada lista todas as movimentações do tipo `entrada`, ordenadas da mais recente para a mais antiga.

**Filtros disponíveis:**
- Busca por produto, lote ou usuário
- Filtro por período (data início / data fim)

**Colunas da tabela:**

| Coluna | Descrição |
|---|---|
| Data | Data e hora do registro |
| Produto | Nome do produto |
| Lote | Código do lote |
| Quantidade | Quantidade registrada |
| Localização | Destino da mercadoria |
| Usuário | Quem registrou |

---

## 5. Saída de Produtos

Registra a retirada de produtos do estoque para consumo, venda ou descarte.

### Como registrar uma saída

1. Acesse **Saída** no menu lateral
2. Clique em **Nova Saída**
3. Preencha os campos:

| Campo | Obrigatório | Descrição |
|---|---|---|
| Lote | Sim | Selecione o lote a ser consumido |
| Quantidade | Sim | Quantidade que está saindo |
| Localização de Origem | Sim | De onde o produto está saindo |
| Motivo | Não | Razão da saída (consumo, venda, descarte) |
| Observação | Não | Notas adicionais |

4. Clique em **Salvar**

> **Atenção:** O sistema valida que a quantidade de saída não ultrapasse o saldo disponível no lote. Se ultrapassar, a operação é bloqueada com mensagem de erro.

### Critério FIFO/FEFO

O sistema sugere automaticamente o lote mais antigo (FIFO — First In, First Out) ou o que vence primeiro (FEFO — First Expired, First Out) para garantir que produtos próximos ao vencimento sejam consumidos primeiro.

---

## 6. Transferência entre Localizações

Move um lote de uma posição do armazém para outra, sem alterar o saldo total do estoque.

### Como registrar uma transferência

1. Acesse **Transferência** no menu lateral
2. Clique em **Nova Transferência**
3. Preencha os campos:

| Campo | Obrigatório | Descrição |
|---|---|---|
| Lote | Sim | Lote a ser movido |
| Quantidade | Sim | Quantidade a transferir (pode ser parcial) |
| Localização de Origem | Sim | Posição atual do produto |
| Localização de Destino | Sim | Nova posição do produto |
| Observação | Não | Motivo da transferência |

4. Clique em **Salvar**

> **Dica:** Use transferências para reorganizar o armazém, separar produtos por lote ou mover itens próximos ao vencimento para área de prioridade.

---

## 7. Lotes

Centraliza a gestão de todos os lotes cadastrados no sistema.

### Visualizar lotes

Acesse **Lotes** no menu lateral. A tabela exibe:

| Coluna | Descrição |
|---|---|
| Código | Número único do lote |
| Produto | Produto associado |
| Fabricação | Data de fabricação |
| Validade | Data de vencimento |
| Saldo | Quantidade atual em estoque |
| Status | Ativo, Vencido, Zerado |
| Localização | Onde está armazenado |

### Status dos lotes

| Status | Significado |
|---|---|
| **Ativo** | Lote dentro do prazo com saldo > 0 |
| **Vencido** | Data de validade já ultrapassada |
| **Zerado** | Saldo = 0, lote consumido integralmente |

### Filtros disponíveis

- **Por produto:** Selecione o produto no dropdown
- **Por status:** Ativo / Vencido / Zerado / Todos
- **Por validade:** Filtro por intervalo de datas
- **Busca livre:** Pesquisa por código do lote

### Detalhes de um lote

Clique em qualquer lote para ver:
- Histórico completo de movimentações (entradas, saídas, transferências)
- Identificações vinculadas (RFID, QR Code)
- Localização atual no mapa do armazém

---

## 8. Produtos

Catálogo de produtos controlados pelo sistema.

### Cadastrar produto

1. Acesse **Produtos** no menu lateral
2. Clique em **Novo Produto**
3. Preencha:

| Campo | Obrigatório | Descrição |
|---|---|---|
| Nome | Sim | Nome do produto (ex: `Farinha de Trigo Tipo 1`) |
| Código SKU | Não | Código interno (ex: `FAR-001`) |
| Unidade | Sim | kg, g, L, un, cx |
| Categoria | Não | Grupo do produto |
| Estoque Mínimo | Não | Quantidade que dispara alerta de estoque baixo |
| Descrição | Não | Informações adicionais |

4. Clique em **Salvar**

### Editar produto

Clique no ícone de edição na linha do produto. Os dados podem ser alterados sem perda de histórico.

> **Atenção:** Não é possível deletar um produto que tenha lotes ativos.

---

## 9. Localizações

Define a estrutura física do armazém, organizada por corredor, nível e posição.

### Estrutura de endereçamento

Cada localização é identificada por três campos:

```
[Corredor] - [Nível] - [Posição]

Exemplo: A - 1 - 01
         B - 3 - 04
```

| Campo | Exemplos | Descrição |
|---|---|---|
| Corredor | A, B, C, D | Letra que identifica a fileira |
| Nível | 1, 2, 3, 4 | Altura da prateleira (1 = térreo) |
| Posição | 01, 02, 03... | Posição horizontal na prateleira |

### Cadastrar localização

1. Acesse **Localizações** no menu lateral
2. Clique em **Nova Localização**
3. Informe corredor, nível e posição
4. Clique em **Salvar**

### Capacidade e ocupação

Cada localização pode ter uma capacidade máxima definida. O sistema exibe a ocupação atual e alerta quando a capacidade está próxima do limite.

---

## 10. Usuários

Gerencia os usuários com acesso ao sistema.

### Cadastrar usuário

1. Acesse **Usuários** no menu lateral (apenas Admin)
2. Clique em **Novo Usuário**
3. Preencha:

| Campo | Obrigatório | Descrição |
|---|---|---|
| Nome | Sim | Nome completo |
| E-mail | Sim | E-mail de login (único) |
| Senha | Sim | Mínimo 6 caracteres |
| Perfil | Sim | admin / operador / auditor |
| Ativo | — | Usuário pode fazer login |

4. Clique em **Salvar**

### Desativar usuário

Clique no toggle **Ativo/Inativo** na linha do usuário. Usuários inativos não conseguem fazer login, mas seu histórico de ações é preservado.

> **Regra:** Não é possível desativar o último administrador do sistema.

---

## 11. Inventário

Realiza a conferência física do estoque por corredor, registrando divergências e calculando a acurácia.

### Iniciar inventário

1. Acesse **Inventário** no menu lateral
2. Clique em **Novo Inventário**
3. Selecione o **corredor** a ser inventariado
4. Adicione uma **observação** (opcional)
5. Clique em **Iniciar**

O sistema registra:
- Usuário responsável
- Data e hora de início
- Corredor selecionado

### Registrar conferência

Para cada posição do corredor, informe a quantidade encontrada fisicamente. O sistema compara com o saldo registrado e calcula:

| Métrica | Descrição |
|---|---|
| **Total de Posições** | Quantidade de posições no corredor |
| **Posições Conferidas** | Quantas já foram verificadas |
| **Divergências** | Posições com diferença entre físico e sistema |
| **Acurácia** | `(Posições sem divergência / Total) × 100` |

### Concluir inventário

Após conferir todas as posições, clique em **Concluir**. O sistema registra a data/hora de conclusão e o status muda para **Concluído**.

Se houver divergências, o operador pode:
- Registrar **ajustes** para corrigir o saldo
- Deixar a divergência registrada para análise posterior

### Histórico de inventários

A tabela exibe todos os inventários realizados com:
- Corredor inventariado
- Responsável
- Data de início e conclusão
- Acurácia atingida
- Status (Em andamento / Concluído / Cancelado)

---

## 12. Auditoria

Registro imutável de todas as ações realizadas no sistema.

> **Importante:** Os registros de auditoria não podem ser alterados ou excluídos por nenhum usuário, incluindo administradores.

### O que é auditado

| Evento | Registrado |
|---|---|
| Login / Logout | Sim |
| Criação de produtos, lotes, localizações | Sim |
| Todas as movimentações (entrada, saída, transferência, ajuste) | Sim |
| Criação e edição de usuários | Sim |
| Inventários (início e conclusão) | Sim |

### Consultar auditoria

1. Acesse **Auditoria** no menu lateral
2. Use os filtros para encontrar eventos específicos:

| Filtro | Descrição |
|---|---|
| **Usuário** | Filtra ações de um usuário específico |
| **Ação** | Tipo de evento (criar, editar, mover...) |
| **Tabela** | Entidade afetada (lote, produto, movimentacao...) |
| **Período** | Intervalo de datas |

### Exportar auditoria

Clique em **Exportar CSV** para baixar o log de auditoria filtrado em formato de planilha.

---

## 13. Mapa do Armazém

Visualização gráfica da ocupação de cada posição do armazém em tempo real.

### Legenda de cores

| Cor | Significado |
|---|---|
| **Verde** | Posição ocupada — produto dentro do prazo |
| **Amarelo** | Produto próximo ao vencimento (≤ 7 dias) |
| **Vermelho** | Produto vencido |
| **Cinza** | Posição vazia |
| **Azul** | Posição selecionada |

### Navegar pelo mapa

- Clique em um **corredor** na barra lateral para filtrar
- Clique em uma **posição** para ver os detalhes do lote armazenado
- Use o zoom (botões + / −) para ampliar áreas específicas

### Informações de uma posição

Ao clicar em uma posição ocupada, o painel lateral exibe:
- Produto e número do lote
- Quantidade disponível
- Data de fabricação e validade
- Dias até o vencimento

---

## 14. Relatórios

Geração de relatórios operacionais e gerenciais.

### Relatório de Movimentações

- **Caminho:** Relatórios → Movimentações
- **Filtros:** Tipo, período, produto, usuário
- **Colunas:** Data, tipo, produto, lote, quantidade, origem, destino, usuário

### Relatório de Estoque Atual

- **Caminho:** Relatórios → Estoque Atual
- **Exibe:** Todos os lotes ativos com saldo, localização e validade
- **Útil para:** Inventário rápido e planejamento de compras

### Relatório de Vencimentos

- **Caminho:** Relatórios → Vencimentos
- **Filtros:** Próximos 7 / 15 / 30 / 60 dias ou personalizado
- **Ação:** Planejar consumo de produtos antes do vencimento

### Relatório de Acurácia

- **Caminho:** Relatórios → Acurácia de Inventário
- **Exibe:** Histórico de inventários com acurácia por corredor ao longo do tempo

### Exportação

Todos os relatórios podem ser exportados em:
- **CSV** — para planilhas (Excel, Google Sheets)
- **PDF** — para impressão e arquivamento

---

## 15. Identificações (RFID/QR)

Vinculação de etiquetas físicas a lotes para rastreio automatizado.

### Tipos de identificação suportados

| Tipo | Uso |
|---|---|
| **RFID** | Leitores de radiofrequência (ex: `RF-AT-001`) |
| **QR Code** | Câmeras ou leitores óticos |
| **Código de Barras** | Leitores de código de barras padrão |

### Cadastrar identificação

1. Acesse **Lotes** e abra o lote desejado
2. Na seção **Identificações**, clique em **Adicionar**
3. Selecione o **tipo** e informe o **código**
4. Clique em **Salvar**

### Consultar por identificação

Na busca geral do sistema, informe o código da etiqueta (ex: `RF-AT-001`). O sistema localiza o lote vinculado e exibe todas as informações.

**Via API:**
```
GET /api/v1/identificacoes/{codigo}
```

---

## 16. Perguntas Frequentes

**P: Posso alterar uma movimentação já registrada?**  
R: Não. Todas as movimentações são imutáveis. Para corrigir um erro, registre um **Ajuste** com o motivo da correção.

**P: O que acontece se o estoque de um lote chegar a zero?**  
R: O lote fica com status **Zerado** e não aparece nas buscas padrão. Ele pode ser consultado no histórico.

**P: Posso cadastrar o mesmo produto em lotes diferentes?**  
R: Sim. Um produto pode ter múltiplos lotes ativos simultaneamente, cada um com sua própria validade e localização.

**P: Como funciona o cálculo de acurácia do inventário?**  
R: `Acurácia = (Posições conferidas sem divergência / Total de posições) × 100`. Uma posição é considerada sem divergência quando a quantidade física confere exatamente com o saldo do sistema.

**P: Posso usar o sistema em múltiplos computadores simultaneamente?**  
R: Sim. O sistema é web-based e suporta múltiplos usuários simultâneos. Cada sessão é independente e autenticada por token JWT.

**P: Qual é o tempo de expiração da sessão?**  
R: O token de autenticação expira em **8 horas**. Após esse período, o sistema solicita novo login.

**P: Como faço backup do banco de dados?**  
R: Execute o comando abaixo no servidor:
```bash
mysqldump -u root -p stockflow > backup_$(date +%Y%m%d).sql
```

**P: O sistema funciona offline?**  
R: Não. O StockFlow requer conexão com o servidor para todas as operações. Não há modo offline.

**P: Como acesso a documentação da API?**  
R: Acesse `http://localhost:3000/api/docs` com o backend rodando. A documentação Swagger/OpenAPI lista todos os endpoints com exemplos de request e response.

---

## Suporte

Para dúvidas, problemas ou sugestões:

- **E-mail:** suporte@stockflow.com
- **Documentação da API:** `http://localhost:3000/api/docs`
- **Versão do sistema:** StockFlow v1.3

---

*StockFlow — Controle de estoque com precisão e rastreabilidade total.*
