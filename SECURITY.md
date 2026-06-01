# Seguranca do StockFlow

## Medidas implementadas

| Camada | Protecao | Status |
|---|---|---|
| Autenticacao | JWT com expiracao configuravel por `JWT_EXPIRES_IN` | OK |
| Senhas | bcrypt com custo 12 | OK |
| Headers HTTP | Helmet com CSP, HSTS, noSniff, frameguard, Referrer-Policy e Permissions-Policy | OK |
| Brute force | Rate limit: 10 tentativas/15min no login | OK |
| DDoS basico | Rate limit geral: 100 req/min por IP nas rotas `/api/v1/` | OK |
| CORS | Restrito por `ALLOWED_ORIGINS` | OK |
| Validacao | `express-validator` em rotas de entrada criticas | OK |
| Logs | Sem log de senhas, tokens ou Authorization | OK |
| Config | Variaveis sensiveis via `.env`, nunca no codigo | OK |
| Auditoria | Registro de operacoes com IP e usuario | OK |

## Token no frontend

O frontend persiste o JWT em `localStorage` para manter a sessao entre recarregamentos.
Esse armazenamento e simples, mas aumenta o impacto de uma falha XSS: qualquer script executado na origem da aplicacao pode ler o token.

Mitigacoes atuais:

- O token nao e logado no console.
- O Axios injeta o token somente no header `Authorization`.
- O backend restringe CORS por origem permitida.
- O backend aplica CSP e headers defensivos.

Para uma versao futura de maior rigor, preferir cookie `HttpOnly`, `Secure`, `SameSite=Strict` com refresh token rotacionado.

## Conformidade

- LGPD: dados pessoais limitados ao necessario.
- Senhas nunca armazenadas em texto plano.
- Tokens de sessao nao sao persistidos no servidor alem da blacklist em memoria usada no logout.

## Roadmap de seguranca

- [ ] 2FA.
- [ ] Refresh token com rotacao.
- [ ] Cookie `HttpOnly` para sessao.
- [ ] WAF em producao.
- [ ] Scan automatico de dependencias no CI/CD.
- [ ] Penetration test externo.

## Reporte de vulnerabilidades

Encontrou uma vulnerabilidade? Entre em contato com a equipe antes de divulgar publicamente.
