# Peter Tecnet — Protocolo de Comunicação dos Agentes

Este repositório contém o canal central de comunicação entre os agentes do ecossistema Peter Tecnet.

## Fonte da verdade

Antes de iniciar QUALQUER tarefa, todo agente deve consultar:

1. `.agents/AGENT_CHAT.md` no repositório `petertecnetdev/petertecnet.com.br`
2. `.agents/CURRENT_STATE.md` no mesmo repositório

## Regra obrigatória de execução

Ao iniciar uma tarefa:
- ler as mensagens mais recentes do chat central;
- identificar mensagens para `@todos`, para o próprio agente/app ou relacionadas ao trabalho atual;
- registrar no chat um evento `START` informando o que será feito.

Durante a tarefa:
- registrar apenas descobertas relevantes, bloqueios, pedidos a outro agente ou decisões;
- antes de alterar arquitetura compartilhada, verificar se outro agente já está trabalhando no mesmo ponto;
- respeitar a arquitetura genérica/reutilizável da API central.

Ao concluir:
- registrar `DONE`, `BLOCKED` ou `REVIEW`;
- informar resumo objetivo, repositório, branch, commit/PR quando existir, testes executados e qualquer próximo passo;
- atualizar `.agents/CURRENT_STATE.md` quando a mudança afetar o estado global do ecossistema.

## Formato das mensagens

Adicionar novas mensagens ao FINAL de `.agents/AGENT_CHAT.md`, sem apagar ou reescrever o histórico existente.

Formato:

```md
### YYYY-MM-DD HH:mm BRT — <autor/agente> — <tipo>
**Para:** @todos | @nome-do-agente | @app
**Assunto:** resumo curto

Mensagem objetiva.

**Repo:** owner/repo
**Branch:** branch
**Commit/PR:** sha, #PR ou n/a
**Status:** START | INFO | QUESTION | REQUEST | REVIEW | DONE | BLOCKED
---
```

## Concorrência

O chat é append-only. Antes de salvar:
1. buscar novamente a versão atual do arquivo;
2. usar o SHA atual;
3. anexar a nova mensagem ao final;
4. se houver conflito, buscar novamente, preservar todas as mensagens e tentar outra vez.

Nunca sobrescrever mensagens de outro agente.

## Prioridade de comandos

1. Ordens explícitas de Pedro/Peter Tecnet
2. Segurança, disponibilidade e prevenção de perda de dados/receita
3. Tarefas já em execução registradas no chat
4. Sugestões dos agentes

## Continuidade

Nenhum agente deve depender somente do histórico do seu chat do ChatGPT. O contexto operacional compartilhado fica no GitHub, principalmente em:
- `.agents/AGENT_CHAT.md`
- `.agents/CURRENT_STATE.md`

Se uma tarefa for retomada em outra execução ou outro dia, começar por esses arquivos.
