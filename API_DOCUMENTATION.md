# API Documentation — StockFlow v3.0

Esta documentação cobre as rotas que existem no código da API (`backend/src/routes`). Os contratos detalhados (campos, regras de negócio e decisões) estão em [`backend/README.md`](backend/README.md); aqui ficam as rotas, os perfis e as convenções.

## Base e autenticação

- **Desenvolvimento:** a API escuta em `http://localhost:3000` e as rotas não têm prefixo (`GET /health`, `POST /auth/login`, ...).
- **Frontend e demonstração:** o navegador chama `/api/...`; o Vite (desenvolvimento) e o Nginx (demonstração) removem o prefixo `/api` antes de repassar à API. Na demonstração a API não publica porta no host.
- **Autenticação:** `Authorization: Bearer <token>` (JWT HS256, validade de 8 horas), obtido em `POST /auth/login`. Todas as rotas, exceto `GET /health` e `POST /auth/login`, exigem token.
- **Perfis:** `operador` e `administrador`. Operador acessa as áreas operacionais; administrador acessa tudo. Rotas só de administrador respondem `403 ACESSO_NEGADO` ao operador.
- **Corpo:** JSON de até 100 KB. Datas em `AAAA-MM-DD`; instantes em ISO 8601. Quantidades e saldos (`NUMERIC`) trafegam como **texto** decimal (até 9 inteiros e 3 decimais).

## Convenções

**Erro** (sempre este formato, sem stack nem detalhe interno):

```json
{ "erro": { "codigo": "VALIDACAO", "mensagem": "…", "campos": [{ "campo": "nome", "mensagem": "…" }] } }
```

`campos` só aparece em `400 VALIDACAO`. Códigos usados: `VALIDACAO`, `CREDENCIAIS_INVALIDAS`, `NAO_AUTENTICADO`, `ACESSO_NEGADO`, `NAO_ENCONTRADO`, `ROTA_NAO_ENCONTRADA`, `REGISTRO_DUPLICADO`, `LOTE_EM_USO`, `LOTE_NAO_ATIVO`, `LOTE_NAO_BLOQUEADO`, `LOTE_COM_ETIQUETA`, `ETIQUETA_DUPLICADA`, `SALDO_INSUFICIENTE`, `SALDO_DESATUALIZADO`, `SALDO_FINAL_NEGATIVO`, `SALDO_EXCEDE_LIMITE`, `AJUSTE_SEM_ALTERACAO`, `LOTE_INDISPONIVEL`, `LOTE_SEM_SALDO`, `DESTINO_IGUAL_ORIGEM`, `LOCALIZACAO_INVALIDA`, `PRODUTO_INATIVO`, `PRODUTO_INVALIDO`, `REFERENCIA_INVALIDA`, `VALOR_FORA_DO_LIMITE`, `REGRA_VIOLADA`, `OPERACAO_RECUSADA`, `CONTAGEM_PENDENTE_EXISTENTE`, `CONTAGEM_JA_FINALIZADA`, `CONTAGEM_NAO_PENDENTE`, `AUTO_INATIVACAO`, `ULTIMO_ADMINISTRADOR`, `SENHA_ATUAL_INCORRETA`, `MUITAS_TENTATIVAS` (429, com `Retry-After`), `BANCO_INDISPONIVEL` e `SERVICO_OCUPADO` (503).

**Listas:** `{ "dados": [...], "pagina": n, "limite": n, "total": n }`, com `pagina` e `limite` na consulta. Auditoria, Histórico de movimentações e Rastreabilidade também aceitam cursor (`antes_de_id` ou `depois_de_id`) e devolvem o próximo cursor na resposta (`proximo_antes_de_id` ou `proximo_depois_de_id`); o cursor nunca deve ser calculado pelo cliente.

**Período:** `de` e `ate` em `AAAA-MM-DD` (dia inteiro, UTC) ou instante completo com `Z` ou deslocamento.

**Limite de tentativas:** `POST /auth/login` e `POST /auth/senha` têm limite por endereço (10 tentativas em 15 minutos no login), respondendo `429 MUITAS_TENTATIVAS`.

**Auditoria:** cada escrita registra o autor e o IP pelas triggers do banco; não existe rota que altere ou apague a auditoria.

## Rotas

### Sistema e conta

| Método e caminho | Perfil | Descrição |
| --- | --- | --- |
| `GET /health` | público | Responde `ok` se a API e o banco estão de pé (`503 BANCO_INDISPONIVEL` se o banco não responde) |
| `POST /auth/login` | público | `{ email, senha }` → `{ token, usuario }` |
| `GET /auth/me` | autenticado | Usuário do token |
| `POST /auth/senha` | autenticado | Troca da própria senha: `{ senha_atual, nova_senha }` (mínimo de 8 caracteres e 72 bytes); `204` |

### Produtos

| Método e caminho | Perfil | Descrição |
| --- | --- | --- |
| `GET /produtos` | operacional | Lista com `busca`, `ativo`, paginação |
| `POST /produtos` | operacional | Cria |
| `GET /produtos/:id` | operacional | Detalhe |
| `PATCH /produtos/:id` | operacional | Edita |
| `POST /produtos/:id/inativar` | operacional | Inativa (não há reativação) |

### Localizações e mapa

| Método e caminho | Perfil | Descrição |
| --- | --- | --- |
| `GET /localizacoes` | operacional | Lista, com `busca` por corredor, nível, posição ou rótulo combinado |
| `POST /localizacoes` | operacional | Cria |
| `GET /localizacoes/:id` | operacional | Detalhe |
| `GET /mapa` | operacional | Posições por corredor e nível, com `total_lotes` e até 50 lotes cada; filtro `corredor` |

### Lotes

| Método e caminho | Perfil | Descrição |
| --- | --- | --- |
| `GET /lotes` | operacional | Lista com `numero_lote`, `status`, `id_produto`, `id_localizacao`, `codigo_etiqueta`; cada lote traz `validade_expirada` |
| `POST /lotes` | operacional | Cria (a quantidade inicial gera a entrada) |
| `GET /lotes/:id` | operacional | Detalhe |
| `POST /lotes/:id/bloquear` | operacional | `{ motivo }` |
| `POST /lotes/:id/desbloquear` | operacional | Desbloqueia |
| `POST /lotes/:id/etiqueta` | operacional | Associa etiqueta `qr_code` ou `rfid` (`{ tipo_identificacao, codigo }`) |

### Movimentações

| Método e caminho | Perfil | Descrição |
| --- | --- | --- |
| `GET /movimentacoes` | operacional | Histórico: filtros `tipo`, `de`, `ate`, `id_lote`, `id_usuario`; cursor `antes_de_id`; traz `numero_lote` e `nome_usuario` |
| `GET /movimentacoes/:id` | operacional | Detalhe |
| `POST /movimentacoes/entrada` | operacional | `{ id_lote, quantidade, motivo?, observacao? }` |
| `POST /movimentacoes/saida` | operacional | Recusa lote vencido, expirado ou bloqueado e saldo insuficiente |
| `POST /movimentacoes/transferencia` | operacional | `{ id_lote, id_localizacao_destino, motivo }` |
| `POST /movimentacoes/ajuste` | **administrador** | `{ id_lote, saldo_exibido, novo_saldo, motivo }` (justificativa de 10 a 255 caracteres); `409 SALDO_DESATUALIZADO` se o saldo mudou |

### Inventário rotativo

| Método e caminho | Perfil | Descrição |
| --- | --- | --- |
| `GET /inventario/contagens` | operacional | `status` = `pendente` (padrão), `concluida` ou `cancelada` |
| `POST /inventario/contagens` | operacional | `{ id_lote, quantidade_contada, observacao? }`; contagem pendente, não altera o saldo; uma pendente por lote |
| `GET /inventario/contagens/:id` | operacional | Detalhe com divergência |
| `POST /inventario/contagens/:id/finalizar` | **administrador** | Soma a divergência ao saldo **atual** e gera um ajuste |
| `POST /inventario/contagens/:id/cancelar` | **administrador** | Cancela sem mexer no saldo |

### Análise

| Método e caminho | Perfil | Descrição |
| --- | --- | --- |
| `GET /dashboard` | operacional | `data_referencia`, `indicadores`, `grafico` (30 dias por dia e tipo), `lotes_por_situacao`, `saldo_por_categoria`, `top_produtos`, `alertas_estoque_minimo` |
| `GET /alertas/vencimento` | operacional | Lotes ativos que vencem em até 30 dias |
| `GET /alertas/vencimento/exportacao` | **administrador** | CSV (UTF-8 com BOM, `;`), até 10.000 linhas |
| `GET /rastreabilidade` | operacional | `numero_lote` **ou** `id_lote`; linha do tempo cronológica com cursor `depois_de_id` |

### Administração

| Método e caminho | Perfil | Descrição |
| --- | --- | --- |
| `GET /usuarios` | **administrador** | Lista com `busca`, `perfil`, `ativo` |
| `POST /usuarios` | **administrador** | Cria |
| `GET /usuarios/:id` | **administrador** | Detalhe |
| `PATCH /usuarios/:id` | **administrador** | Edita nome, e-mail, perfil e senha (opcional) |
| `POST /usuarios/:id/inativar` | **administrador** | Inativa; `409` para a si mesmo e para o último administrador |
| `GET /auditoria` | **administrador** | Filtros `id_usuario`, `tabela`, `operacao`, `ip`, `de`, `ate`, `valor_novo`, `valor_anterior` (JSON simples e validado); cursor `antes_de_id` |

## Divergência registrada

O arquivo anterior descrevia o protótipo (`/api/v1`, `{ "error": … }`, Express 4 e MySQL). Foi substituído por esta versão; o protótipo continua nas pastas `stockflow-api` e `stockflow-frontend`, intocadas, e não segue estas convenções.
