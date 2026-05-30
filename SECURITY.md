# Segurança do StockFlow

## Medidas implementadas

| Camada | Proteção | Status |
|---|---|---|
| Autenticação | JWT com expiração de 8h | ✅ |
| Senhas | bcrypt com custo 12 | ✅ |
| Headers HTTP | Helmet (XSS, Clickjacking, HSTS, noSniff) | ✅ |
| Brute force | Rate limit: 10 tentativas/15min no login | ✅ |
| DDoS básico | Rate limit global: 200 req/15min por IP | ✅ |
| CORS | Restrito à origem do frontend | ✅ |
| Validação | express-validator em rotas de entrada críticas | ✅ |
| Logs | Sem exposição de senhas ou tokens | ✅ |
| Config | Variáveis sensíveis via .env, nunca no código | ✅ |
| Auditoria | Registro de operações com IP e usuário | ✅ |

## Conformidade

- LGPD: dados pessoais limitados ao necessário (e-mail, nome)
- Senhas nunca armazenadas em texto plano
- Tokens de sessão não persistidos no servidor

## Roadmap de segurança (próximas versões)

- [ ] 2FA (autenticação de dois fatores)
- [ ] Refresh token com rotação
- [ ] WAF (Web Application Firewall) em produção
- [ ] Scan automático de dependências no CI/CD
- [ ] Penetration test externo

## Reporte de vulnerabilidades

Encontrou uma vulnerabilidade? Entre em contato com a equipe antes de divulgar publicamente.
