# Roteiro de apresentação — StockFlow v3.0 (10 minutos)

Pré-requisito: a demonstração no ar (`./deploy/subir.sh`) e o navegador em `https://localhost:8443`. Na primeira vez o navegador avisa sobre o certificado (é autoassinado, gerado no próprio computador): aceite a exceção.

Credenciais (dados de demonstração, não são segredos reais):

- Administrador: `carlos.matos@stockflow.demo` / `Admin@Demo2026`
- Operador: `joao.almeida@stockflow.demo` / `Operador@Demo2026`

Os números de lote mudam conforme o dia em que o banco foi criado (o número leva o ano e o mês da validade). Por isso o roteiro manda **escolher na tela** o lote certo em vez de citar um número fixo. A etiqueta QR de cada lote é `QR-` seguido do número do lote (os lotes com RFID têm um código `E200…`, visível no detalhe do lote).

## Passo a passo

| Tempo | O que fazer | O que mostrar e dizer |
| --- | --- | --- |
| 0:00 | Abrir a tela de login | Cena 3D de armazém em CSS puro (sem biblioteca), que acompanha o mouse; tema claro e escuro; com movimento reduzido no sistema a cena fica parada. Entrar como **administrador**. |
| 1:00 | **Dashboard** | Seis indicadores do dia, movimentações dos últimos 30 dias por tipo, entradas contra saídas, lotes por situação, saldo por categoria, produtos mais movimentados, estoque abaixo do mínimo, atividade recente e vencimentos. Tudo calculado no banco; gráficos em SVG puro. Prova: RF11 e a regra de estoque mínimo. |
| 2:00 | **Entrada** com leitura de etiqueta simulada | Em *Lotes*, escolher um lote ativo com bastante saldo. Em *Entrada*, digitar `QR-<número do lote>` no campo de etiqueta e Enter: o lote é carregado como se a etiqueta tivesse sido lida. Registrar a entrada de, por exemplo, 10 unidades e mostrar o saldo mudando (o número pulsa). Prova: RF10 (leitura de etiqueta), saldo transacional com decimais exatos. |
| 3:30 | **Saída** e regra de bloqueio | Registrar uma saída pequena no mesmo lote. Depois ir em *Lotes*, filtrar por **Bloqueado**, abrir um lote bloqueado e ver o motivo; tentar uma saída nele em *Saída*: o sistema recusa. Prova: regras de lote vencido ou bloqueado, também garantidas por trigger no banco. |
| 4:30 | **Bloqueio** de um lote | Em *Lotes*, no menu `⋮` de um lote ativo, *Bloquear* com um motivo. Mostrar o novo status e que a saída passou a ser recusada. Prova: RF de bloqueio e desbloqueio com motivo. |
| 5:30 | **Inventário** com divergência | Em *Inventário*, registrar uma contagem de um lote com quantidade **diferente** do saldo (a tela mostra a divergência). A contagem fica *pendente* e o saldo não muda. Como administrador, abrir a lista de pendentes (a demonstração já traz algumas com divergência), escolher *Finalizar*: a confirmação mostra saldo da contagem, contado, divergência e avisa que ela é somada ao saldo **atual**; depois mostra o ajuste gerado. Prova: RF15, e que somente o administrador finaliza. |
| 7:00 | **Rastreabilidade** | Em *Rastreabilidade*, buscar o número do lote que acabou de movimentar: dados do lote, saldo e linha do tempo cronológica (entrada, saídas, transferências, ajustes, contagens como eventos informativos). Prova: RF14. |
| 8:00 | **Auditoria** | Em *Auditoria* (só administrador), filtrar por tabela *Lote* ou por usuário, expandir um registro e ver valor anterior e novo lado a lado, com o autor e o IP. As operações que acabaram de ser feitas aparecem no topo com o autor correto. Prova: RF13, auditoria gerada pelo banco. |
| 8:45 | **Mapa** e **Vencimentos** | *Mapa do Armazém*: posições por corredor e nível, painel com os lotes da posição. *Vencimentos*: lotes ativos que vencem em até 30 dias; como administrador, **Exportar CSV** (o arquivo abre no Excel, com proteção contra fórmulas). Prova: RF12 e RF08. |
| 9:30 | **Permissões** | Sair e entrar como **operador**: o menu não mostra Usuários, Auditoria nem Ajuste de estoque; em *Inventário* não há finalizar nem cancelar; abrir `/auditoria` pela barra de endereço dá “Acesso negado”. Prova: perfis da especificação, e que o backend também recusa (403). |

Se sobrar tempo: *Usuários* (criar, editar, inativar com confirmação; o sistema impede inativar o último administrador), *Ajuste de estoque* (justificativa obrigatória; o conflito de saldo é detectado) e o atalho **Ctrl+K** para ir a qualquer tela pelo nome.

## O que é demonstração (sem exagero)

- **Dados de exemplo.** Produtos, lotes, usuários e histórico foram gerados por um script para a apresentação. As movimentações têm datas históricas dos últimos 60 a 90 dias, relativas ao dia em que o banco foi criado, e o saldo de cada lote é conferido por uma verificação (`./deploy/verificar.sh`).
- **Auditoria com a data da carga.** A tabela de auditoria é imutável e o script de carga não a altera. Por isso os registros de auditoria **dos dados de exemplo** mostram a data e a hora em que a demonstração foi carregada, e não as datas históricas das movimentações. O que você fizer durante a apresentação aparece com a data real.
- **Carga com um trigger desligado.** Só durante a carga inicial, o trigger que bloqueia saída de lote vencido ou bloqueado fica desabilitado, para permitir saídas históricas de lotes que hoje estão vencidos ou bloqueados. Ele é religado antes do fim da carga e a verificação confirma isso.
- **Certificado local.** O HTTPS usa um certificado autoassinado gerado no computador; em produção real seria um certificado de uma autoridade confiável.
- **Leitor físico não testado.** A leitura de etiqueta funciona pela digitação simulada (e por leitor que age como teclado, detectado pela velocidade das teclas). A conexão serial (Web Serial) existe, só funciona em Chromium e em HTTPS ou `localhost`, e **nunca foi testada com um leitor de verdade**.
- **Senhas de demonstração.** São públicas neste repositório de propósito; os segredos reais do Compose (banco e JWT) são gerados aleatoriamente em `deploy/.env`, fora do git.
- **Saldo por categoria em kg.** Produtos em kg entram direto; unidades de contagem (un, cx, rolo, pct) são multiplicadas pelo peso unitário; litros e produtos sem peso informado ficam de fora, e o gráfico mostra quantos lotes ficaram de fora.

## Verificações para citar, se perguntarem

- `./deploy/fumaca.sh`: teste de fumaça contra a demonstração (HTTPS, cabeçalhos de segurança, login dos dois perfis, leituras, uma entrada e uma saída, API e banco sem porta publicada).
- `./deploy/verificar.sh`: invariantes no banco inteiro (saldo do lote igual ao saldo posterior da última movimentação que altera saldo, cadeia sem buracos, deltas coerentes, saídas válidas, nada no futuro e triggers existentes e habilitados); sai com erro se houver qualquer violação. A mesma verificação roda no fim da carga, antes do COMMIT.
- Testes automatizados: 309 no backend e 240 no frontend.
