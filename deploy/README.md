# StockFlow v3.0 — demonstração (Docker Compose)

Esta pasta sobe o sistema completo como se já estivesse em uso: PostgreSQL 16 com dados de demonstração, a API, e o Nginx servindo o frontend em HTTPS. É um projeto Compose separado (`stockflow-demo`) com volume próprio (`stockflow_demo_pgdata`); não toca no banco de desenvolvimento.

## Subir e derrubar

```
./deploy/subir.sh      # gera deploy/.env e o certificado local se não existirem, constrói e sobe
./deploy/derrubar.sh   # derruba os serviços e mantém o volume (os dados continuam)
```

Os scripts são de bash (no Windows, Git Bash) e precisam de Docker e de `openssl`. Para recomeçar do zero com dados novos sem apagar nada, mude `VOLUME_DO_BANCO` em `deploy/.env` (por exemplo `stockflow_demo_pgdata_v2`) e rode `./deploy/subir.sh`; o banco novo é criado e carregado do zero.

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

### Login pré-preenchido (modo demonstração)

Na demonstração, a tela de login abre com o e-mail e a senha do administrador de demonstração já preenchidos, uma faixa "Ambiente de demonstração - dados fictícios" e dois atalhos ("Entrar como Administrador (demo)" e "Entrar como Operador (demo)") que só preenchem os campos; o login continua exigindo clicar em Entrar. O modo só existe na imagem construída por este Compose: `docker-compose.yml` passa `VITE_MODO_DEMO=true` e as credenciais como argumentos de build, lidas de `DEMO_ADMIN_EMAIL`, `DEMO_ADMIN_SENHA`, `DEMO_OPERADOR_EMAIL` e `DEMO_OPERADOR_SENHA` em `deploy/.env` (o `subir.sh` acrescenta essas quatro linhas se faltarem; os valores padrão são os da tabela acima). Em desenvolvimento e em qualquer build sem essas variáveis o login abre vazio. As credenciais não estão no código-fonte, mas, por serem argumentos de build, ficam dentro do pacote JavaScript servido: por isso devem ser só credenciais de demonstração, nunca de um ambiente real. Para mudar o preenchimento, edite `deploy/.env` e reconstrua só o web: `docker compose -p stockflow-demo up -d --no-deps --build web` (dentro de `deploy/`).

## O que há nos dados

Cerca de 45 produtos, 120 posições (3 corredores, 4 níveis, 10 posições), ~146 lotes com etiquetas QR e RFID e 60 a 90 dias de histórico: entradas, saídas, transferências, ajustes e contagens pendentes, concluídas e canceladas, com lotes vencendo, vencidos e bloqueados e produtos abaixo do estoque mínimo. As movimentações têm datas históricas (relativas ao dia em que o banco é criado). A auditoria é gerada pelas próprias triggers do banco, com o autor de cada operação, e **registra o instante real da carga**: o seed não altera nenhuma linha de `auditoria_log` (tabela imutável), então todos os registros de auditoria da demonstração mostram a data e a hora em que os dados foram carregados, não as datas históricas das movimentações.

Exceção só do seed da demonstração: o trigger `trg_bloquear_saida` fica desabilitado durante a carga inicial (para inserir saídas históricas de lotes que hoje estão vencidos ou bloqueados) e é reabilitado antes do `COMMIT`; `./deploy/verificar.sh` confirma que ele está habilitado no fim.

## Verificações

```
./deploy/fumaca.sh      # teste de fumaça contra o Compose de pé (HTTPS, login, leituras, entrada e saída, cabeçalhos, portas)
./deploy/verificar.sh   # contagens e invariante de saldo no banco inteiro
```

Invariante de saldo: o saldo de cada lote é o `saldo_posterior` da última movimentação concluída que altera saldo (entrada, saída ou ajuste), e a cadeia de saldos não tem buracos.
