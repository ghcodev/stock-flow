# StockFlow v3.0 — demonstração (Docker Compose)

Esta pasta sobe o sistema completo como se já estivesse em uso: PostgreSQL 16 com dados de demonstração, a API, e o Nginx servindo o frontend em HTTPS. É um projeto Compose separado (`stockflow-demo`) com volume próprio (`stockflow_demo_pgdata`); não toca no banco de desenvolvimento.

## Subir e derrubar

```
./deploy/subir.sh      # gera deploy/.env e o certificado local se não existirem, constrói e sobe
./deploy/derrubar.sh   # derruba os serviços e mantém o volume (os dados continuam)
```

Os scripts são de bash (no Windows, Git Bash) e precisam de Docker e de `openssl`. Para recomeçar do zero, apague o volume de propósito: `docker volume rm stockflow_demo_pgdata` (com os serviços derrubados).

## Portas

| Porta | Uso |
| --- | --- |
| 8443 | HTTPS: `https://localhost:8443` (única entrada do sistema) |
| 8080 | HTTP: redireciona para o HTTPS |

A API e o banco não publicam porta: ficam só na rede interna do Compose. Para acessar de outro computador da rede, defina `PUBLICAR_EM=0.0.0.0` em `deploy/.env`. O certificado é autoassinado: o navegador avisa na primeira vez; aceite a exceção.

## Credenciais de demonstração

São dados de demonstração, **não são segredos reais**: existem só neste banco de exemplo.

| Perfil | E-mail | Senha |
| --- | --- | --- |
| Administrador | `carlos.matos@stockflow.demo` | `Admin@Demo2026` |
| Administrador | `fernanda.ribeiro@stockflow.demo` | `Admin@Demo2026` |
| Operador | `joao.almeida@stockflow.demo` | `Operador@Demo2026` |
| Operador | `beatriz.nogueira@stockflow.demo` | `Operador@Demo2026` |
| Operador | `rafael.lima@stockflow.demo` | `Operador@Demo2026` |
| Operador | `camila.teixeira@stockflow.demo` | `Operador@Demo2026` |

Os segredos reais do Compose (senhas do banco e `JWT_SECRET`) são gerados aleatoriamente em `deploy/.env` (fora do git).

## O que há nos dados

Cerca de 45 produtos, 120 posições (3 corredores, 4 níveis, 10 posições), ~146 lotes com etiquetas QR e RFID e 60 a 90 dias de histórico: entradas, saídas, transferências, ajustes e contagens pendentes, concluídas e canceladas, com lotes vencendo, vencidos e bloqueados e produtos abaixo do estoque mínimo. A auditoria é gerada pelas próprias triggers do banco, com o autor de cada operação. As datas são relativas ao dia em que o banco é criado.

## Verificações

```
./deploy/fumaca.sh      # teste de fumaça contra o Compose de pé (HTTPS, login, leituras, entrada e saída, cabeçalhos, portas)
./deploy/verificar.sh   # contagens e invariante de saldo no banco inteiro
```

Invariante de saldo: o saldo de cada lote é o `saldo_posterior` da última movimentação concluída que altera saldo (entrada, saída ou ajuste), e a cadeia de saldos não tem buracos.
