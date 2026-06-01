---
name: frontend-audit
description: Auditoria obrigatoria apos qualquer implementacao visual no StockFlow.
---

# StockFlow Frontend Audit

Use esta skill depois de qualquer criacao, melhoria ou refatoracao visual.

## Objetivo

Avaliar se a tela implementada segue o padrao enterprise do StockFlow, preserva consistencia com o produto e esta pronta para commit.

## Checklist Obrigatorio

Avaliar:
- Hierarquia visual.
- Clareza operacional.
- Consistencia com Dashboard.
- Consistencia com Produtos.
- Consistencia com Lotes.
- Uso correto de tokens CSS.
- Ausencia de hex hardcoded, `rgb()` e `hsl()`.
- Ausencia de estilos duplicados desnecessarios.
- Tabelas.
- Cards.
- KPI strips.
- Badges.
- Drawers.
- Filtros.
- Botoes.
- Menus contextuais `⋮`.
- Estados vazios.
- Responsividade.
- Acessibilidade basica.
- Performance.
- Console sem erro.
- Build sem erro.

## Criterios

### Hierarquia Visual
- O usuario entende o que e mais importante rapidamente.
- Itens criticos aparecem antes de itens administrativos.
- A pagina nao parece um CRUD generico.

### Clareza Operacional
- KPIs indicam decisao ou prioridade.
- Filtros reduzem tempo de busca.
- Tabelas permitem comparar, priorizar e agir.

### Consistencia
- A tela deve parecer parte do mesmo produto que Dashboard, Produtos e Lotes.
- Usar mesmos tokens, densidade, badges, botoes e padroes de tabela.

### Tokens CSS
- Qualquer cor deve usar `var(--color-*)`.
- Raios devem usar tokens quando aplicavel.
- Sombras devem usar tokens quando aplicavel.

### Tabelas
- Sticky header.
- Hover de linha.
- Ordenacao quando aplicavel.
- Busca e filtros rapidos.
- Acoes agrupadas.

### Drawers
- Contextuais, laterais e fechaveis por `ESC`.
- Sem substituir fluxo critico por modal desnecessario.
- Acoes visiveis e relevantes.

### Acessibilidade Basica
- Botoes com texto ou `aria-label`.
- Contraste coerente via tokens.
- Foco e hover preservados.
- Sem texto cortado em controles principais.

### Performance
- Evitar recomputacoes pesadas sem `useMemo`.
- Evitar reloads desnecessarios.
- Nao carregar dados extras sem necessidade operacional.

## Validacao Tecnica

Executar quando aplicavel:
- `npm run build`
- Verificacao de console no navegador quando disponivel.
- Busca por hex hardcoded, `rgb(` e `hsl(` nos arquivos alterados.
- Revisao do diff.
- Para documentacao, confirmar que nenhuma tela, rota, dependencia ou API foi inventada.

## Saida Obrigatoria

Responder sempre neste formato:

```text
Nota UI: /10
Nota UX: /10
Nota Enterprise: /10

Problemas encontrados:
- ...

Correcoes obrigatorias:
- ...

Correcoes recomendadas:
- ...

Aprovado para commit? Sim/Não
```

Se houver qualquer cor hardcoded, quebra de build, erro de console, componente visual incoerente ou divergencia grave do design system, o resultado deve ser:

```text
Aprovado para commit? Não
```

## Auditoria De Documentacao

Quando a alteracao for documental:
- Conferir se os nomes das telas batem com `src/pages`.
- Conferir se rotas batem com `src/App.jsx`.
- Conferir se endpoints citados existem em `stockflow-api/src/routes`.
- Conferir se tabelas citadas existem em `database/setup.sql` ou registrar divergencia.
- Conferir se o build continua valido quando solicitado.
