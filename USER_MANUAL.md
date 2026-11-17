# Manual do Usuário — StockFlow v3.0

Este manual descreve as telas reais da v3.0, separadas por perfil. Para subir o sistema e para as credenciais de demonstração, veja o [`README.md`](README.md); para uma apresentação guiada, veja [`docs/ROTEIRO_APRESENTACAO.md`](docs/ROTEIRO_APRESENTACAO.md).

## Primeiros passos

1. Abra o endereço do sistema (na demonstração, `https://localhost:8443`; o certificado é autoassinado, aceite a exceção do navegador).
2. Informe **e-mail e senha** e entre. A sessão dura até 8 horas ou até você sair ou fechar a aba; depois disso o sistema volta ao login.
3. O botão de sol e lua alterna entre o tema claro e o escuro. Em celular, o menu lateral abre pelo botão de menu no topo.
4. **Ctrl+K** (ou o botão "Buscar tela") abre uma busca para ir a qualquer tela pelo nome; só aparecem as telas do seu perfil.

Por segurança, depois de 10 tentativas de login erradas em 15 minutos o sistema pede para aguardar.

## O que cada perfil vê

| Tela | Operador | Administrador |
| --- | --- | --- |
| Dashboard, Produtos, Lotes, Mapa do Armazém | sim | sim |
| Entrada, Saída, Transferência | sim | sim |
| Inventário (registrar contagem) | sim | sim |
| Inventário (finalizar e cancelar contagem) | não | sim |
| Ajuste de estoque | não | sim |
| Histórico, Rastreabilidade, Vencimentos | sim | sim |
| Exportar vencimentos em CSV | não | sim |
| Usuários | não | sim |
| Auditoria | não | sim |
| Meu Perfil | sim | sim |

Quem não tem permissão não vê o item no menu e, se abrir o endereço direto, recebe "Acesso negado".

## Telas para os dois perfis

### Dashboard
Visão geral do dia: produtos ativos, lotes com saldo, vencidos, bloqueados, movimentações de hoje e divergências de inventário; movimentações dos últimos 30 dias por tipo; entradas contra saídas; lotes por situação; saldo por categoria em kg (produtos em kg direto; caixas, unidades, rolos e pacotes multiplicados pelo peso unitário; litros e produtos sem peso ficam de fora, com aviso de quantos lotes); produtos mais movimentados; produtos abaixo do estoque mínimo; atividade recente; e lotes que vencem em até 30 dias. O botão **Atualizar** recarrega os dados; se uma atualização falhar, os dados anteriores continuam na tela com um aviso.

### Produtos
Lista com busca por nome ou categoria e filtro Ativos, Inativos ou Todos. **Novo produto** abre um painel lateral; no menu `⋮` de cada linha: Visualizar, Editar e Inativar (com confirmação). Um produto inativo deixa de aceitar novos lotes e não é reativado por esta tela.

### Lotes
Lista com busca por número do lote e filtros por situação, produto e localização. **Novo lote**, e no painel de cada lote: detalhes, **Bloquear** (com motivo), **Desbloquear** e **Associar etiqueta** (QR Code ou RFID). Lotes vencidos ou com validade expirada aparecem sinalizados. Um leitor de etiqueta, ou a digitação do código da etiqueta, abre o lote correspondente.

### Mapa do Armazém
Posições agrupadas por corredor e nível, com filtro por corredor. Clique em uma posição para ver os lotes armazenados nela; se houver mais de 50, um link leva à tela de Lotes filtrada por aquela posição.

### Entrada, Saída e Transferência
1. Escolha o lote: leia a etiqueta (ou digite o código no campo de etiqueta e tecle Enter) ou busque o lote pelo número.
2. Informe os dados: quantidade (até 3 casas decimais) e motivo opcional na entrada e na saída; destino e justificativa na transferência.
3. Registre. O resultado mostra o saldo antes e depois.

Regras: a saída é recusada para lote bloqueado, vencido ou com validade expirada e quando o saldo é insuficiente; a transferência só vale para lote ativo e com saldo, e o destino deve ser outra localização. Se a conexão cair no meio do registro, o sistema avisa e pede para conferir o Histórico antes de repetir, para não duplicar a operação.

### Inventário
Registre uma contagem escolhendo o lote e informando a quantidade contada (zero é permitido). A contagem fica **pendente** e **não altera o saldo**. A lista mostra as contagens Pendentes, Concluídas e Canceladas, com a divergência. Só pode haver uma contagem pendente por lote.

### Histórico
Todas as movimentações, das mais recentes para as mais antigas, com filtros por tipo, período, lote e usuário (o filtro de usuário é do administrador; "Só as minhas" mostra as suas). Use **Carregar mais** para ver páginas anteriores.

### Rastreabilidade
Digite o número exato do lote (ou leia a etiqueta). A tela mostra os dados do lote, o saldo atual e a linha do tempo completa, da primeira à última movimentação. Contagens de inventário aparecem como eventos informativos: não alteram o saldo.

### Vencimentos
Lotes ativos com validade entre hoje e 30 dias, com o prazo restante.

### Meu Perfil
Seus dados (nome, e-mail e perfil, alterados só por um administrador) e a troca da própria senha: informe a senha atual, a nova (mínimo de 8 caracteres) e a confirmação. Sessões já abertas continuam válidas até expirar.

## Telas só do administrador

### Inventário: finalizar e cancelar
No menu `⋮` de uma contagem pendente: **Finalizar** mostra o saldo da contagem, o contado, a divergência e o saldo atual do lote, e avisa que a divergência é somada ao saldo **atual** (não ao da hora da contagem). Ao confirmar, o sistema gera um ajuste e conclui a contagem. Se o saldo atual não comportar a divergência, a finalização é bloqueada. **Cancelar contagem** encerra sem mexer no saldo.

### Ajuste de estoque
Escolha o lote, veja o saldo exibido, informe o novo saldo e a justificativa (de 10 a 255 caracteres). Uma confirmação mostra "de X para Y". Se o saldo do lote mudou desde que foi exibido, o sistema avisa, recarrega o saldo e pede nova confirmação; nada é gravado sozinho.

### Vencimentos: exportar CSV
O botão **Exportar CSV** baixa a lista de vencimentos em um arquivo que abre no Excel (UTF-8, separador ponto e vírgula).

### Usuários
Lista com busca e filtros de situação e perfil. **Novo usuário** (nome, e-mail, perfil e senha de pelo menos 8 caracteres), **Editar** (a senha em branco mantém a atual) e **Inativar** com confirmação. O sistema não deixa inativar o último administrador ativo nem a si mesmo, e não aceita e-mail repetido. Não há reativação por esta tela.

### Auditoria
Registro somente leitura, dos mais recentes para os mais antigos, com filtros por usuário, tabela, operação, IP, período e conteúdo (um JSON simples, por exemplo `{"status_lote":"bloqueado"}`). Clique na seta de uma linha para ver o valor anterior e o novo lado a lado. Operações do sistema, como a marcação automática de lote vencido, aparecem como "Sistema".

## Detalhes úteis

- **Horários:** nas telas de análise (Histórico, Rastreabilidade, Auditoria, Inventário) data e hora aparecem em UTC, e os filtros de período também são UTC.
- **Listas longas:** a tela mostra no máximo 300 itens; ao passar disso, os primeiros já carregados são ocultados e o botão **Voltar ao início** recarrega a lista.
- **Erros de tela:** se uma tela não carregar (por exemplo, a conexão caiu ou o sistema foi atualizado), aparece uma mensagem com **Recarregar a aplicação**; erros ao exibir uma tela oferecem também **Tentar de novo**.
- **Leitor de etiqueta:** um leitor que age como teclado funciona nas telas que pedem lote; a conexão direta por porta serial (Web Serial) existe para navegadores Chromium em HTTPS ou `localhost`, mas **não foi testada com um leitor físico**.

## Divergência registrada

O manual anterior descrevia telas do protótipo (login por código de usuário, ocupação do armazém, curva ABC, integração SAP por JSON, entre outras) que não existem na v3. O arquivo `docs/MANUAL_USUARIO.md` agora apenas aponta para este.
