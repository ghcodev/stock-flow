# Segurança do StockFlow v3.0

Este documento lista o que **existe no código e na configuração da v3.0**. Tudo o que está marcado como verificado foi conferido por teste automatizado, pelo teste de fumaça (`deploy/fumaca.sh`) ou no navegador; o que não foi testado está dito como tal.

## Medidas implementadas

| Camada | Proteção | Onde |
| --- | --- | --- |
| Autenticação | JWT HS256 com validade de 8 horas; `JWT_SECRET` de pelo menos 32 caracteres (a API não sobe sem ele) | `backend/src/services/auth.service.ts`, `config.ts` |
| Senhas | bcrypt com custo 12; mínimo de 8 caracteres e máximo de 72 bytes; senha nunca vai para log nem para a auditoria (`senha_hash` é removido do JSON auditado) | `usuario.service.ts`, trigger de auditoria |
| Tentativas de login | 10 por endereço em 15 minutos (`429 MUITAS_TENTATIVAS`); mesma regra para a troca de senha | `rate-limit.middleware.ts` |
| Mensagens de erro | formato único sem stack nem detalhe interno; credencial inválida não diz se foi o e-mail ou a senha | `error.middleware.ts` |
| Autorização | perfil `operador` ou `administrador` verificado no backend em cada rota; o frontend só espelha | `perfil.middleware.ts` |
| Entrada de dados | validação de todos os campos (tipos, tamanhos, `NUL`, decimais, limites de inteiro); corpo JSON de até 100 KB; filtro JSON da auditoria limitado em profundidade, chaves e tamanho, sem `senha_hash` | validadores, `filtro-json.ts` |
| Banco | consultas parametrizadas (Prisma e `$queryRaw` com parâmetros); papel `stockflow_app` com privilégios mínimos: não altera nem apaga a auditoria | `03_roles.sh` |
| Auditoria | triggers gravam autor, IP, valor anterior e novo; não existe rota que altere a auditoria | `02_triggers.sql` |
| Integridade de saldo | `CHECK` de saldo não negativo e transação com trava de lote; trigger bloqueia saída de lote vencido ou bloqueado | esquema, triggers, serviços |
| Exportação CSV | só administrador; gerada sem biblioteca; células que começam com `=`, `+`, `-`, `@`, tabulação ou CR recebem apóstrofo (proteção contra fórmulas) | `csv.ts` |
| Proxy | Nginx sobrescreve `X-Forwarded-For` com o endereço real; a API usa `trust proxy 1` | `deploy/nginx`, `app.ts` |
| Transporte (demonstração) | HTTPS TLS 1.2/1.3 e HTTP redirecionando; HSTS só no HTTPS | `deploy/nginx` |
| Cabeçalhos (demonstração) | `Content-Security-Policy` restrita (`default-src 'self'`, sem `unsafe-eval`, `frame-ancestors 'none'`), `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy` | `deploy/nginx/seguranca.conf` |
| Superfície de rede (demonstração) | API e banco sem porta publicada no host; o Nginx é a única entrada | `deploy/docker-compose.yml` |
| Contêiner da API | usuário não root; imagem com versão fixa | `backend/Dockerfile` |
| Frontend | token só em `sessionStorage` e removido ao sair ou expirar; nenhum dado da API é inserido como HTML; 401 encerra a sessão; nenhuma credencial no código | `frontend/src/sessao`, `api/cliente.ts` |

## Verificado

- Testes automatizados: 307 no backend e 240 no frontend.
- `deploy/fumaca.sh`: cabeçalhos de segurança presentes, redirecionamento HTTP para HTTPS, login dos dois perfis, área de administrador negada ao operador, API e banco sem porta publicada, `X-Forwarded-For` forjado não derruba a API.
- No navegador, com a CSP ativa, a aplicação abre e funciona sem violações; a própria CSP impede que o site seja incluído em um quadro.

## Limites e riscos conhecidos

- O certificado da demonstração é autoassinado; em um ambiente real seria preciso um emitido por uma autoridade confiável.
- Os segredos da demonstração são gerados localmente em `deploy/.env`; não há gestão de segredos, rotação nem política de backup descritas ou testadas aqui.
- O limite de tentativas é em memória, por processo: com mais de uma réplica da API o contador não é compartilhado.
- O token é um JWT sem lista de revogação: depois da troca de senha, sessões já abertas continuam válidas até expirar (até 8 horas).
- Não foi feito teste de intrusão nem varredura automática de vulnerabilidades; a conexão serial (Web Serial) nunca foi testada com hardware real.
- A auditoria da demonstração registra o instante da carga dos dados de exemplo (veja `deploy/README.md`).

## Divergência registrada

O documento anterior descrevia o protótipo (Helmet, CORS por `ALLOWED_ORIGINS`, limite geral de 100 requisições por minuto, `JWT_EXPIRES_IN`, prefixo `/api/v1`). Nada disso existe na v3: os cabeçalhos vêm do Nginx, não há CORS (navegador e API na mesma origem) e não há limite geral de requisições, apenas o de login e de troca de senha.
