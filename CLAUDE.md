# REGRAS OBRIGATÓRIAS — LER ANTES DE QUALQUER AÇÃO

## GIT
- Antes de qualquer tarefa: git add . && git commit -m "backup: [nome da tarefa]"
- Nunca commitar sem minha confirmação
- Nunca fazer git reset, rebase ou force push

## ARQUIVOS VISUAIS — PROTEÇÃO TOTAL
- Nunca reescrever componentes inteiros — só alterações cirúrgicas
- Arquivos protegidos: dashboard, layouts, UI, pages, components
- Sempre mostrar o diff antes de salvar qualquer alteração visual
- Pedir confirmação explícita: "Posso alterar [arquivo]?"

## ANTES DE CADA TAREFA
- Explique o que vai fazer ANTES de fazer
- Liste quais arquivos serão tocados
- Aguarde meu "pode seguir" antes de executar

## BANCO DE DADOS
- Nunca rodar migrations sem minha confirmação
- Nunca deletar dados ou tabelas
- Sempre fazer backup antes de alterar schema

## PROIBIDO SEM PERMISSÃO EXPLÍCITA
- Deletar arquivos
- Renomear arquivos ou pastas
- Instalar ou remover dependências
- Alterar variáveis de ambiente
- Refatorar código que está funcionando

## CÓDIGO
- Nunca deixar console.log ou debug code no código final
- Não duplicar código — se repetir 2x, vire função
- Nunca usar "any" em TypeScript sem justificativa
- Inputs sempre validados antes de usar

## SEGURANÇA
- Nunca expor stack trace ao usuário final
- Toda rota nova precisa de autenticação por padrão
- Nunca logar senhas, tokens ou dados pessoais

## DEPENDÊNCIAS
- Antes de instalar qualquer pacote: mostrar nome, tamanho, última atualização e alternativas
- Nunca instalar pacotes com vulnerabilidades conhecidas

## COMUNICAÇÃO
- Se a tarefa for complexa, divida em etapas e mostre o plano primeiro
- Se encontrar algo estranho, pare e avise antes de continuar
- Se não tiver certeza, pergunte — nunca assuma
- Ao terminar, liste o que foi feito e o que ficou pendente

## ESPECÍFICO — StockFlow
- Dashboard, Mapa do Armazém e movimentações são críticos — proteção máxima
- Alterações em lotes, estoque ou rastreabilidade precisam de confirmação dupla
- Dados de auditoria são imutáveis — nunca alterar tabelas de log
- Gráficos usam SVG puro — nunca substituir por bibliotecas externas
- Alertas e notificações não podem ser desativados silenciosamente
