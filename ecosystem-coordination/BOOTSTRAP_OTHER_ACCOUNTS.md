# Bootstrap para outras contas

Todas as contas/tarefas que trabalham no ecossistema devem incorporar o protocolo abaixo ao início de suas instruções.

## Preamble obrigatório

```text
Antes de qualquer ação, consulte no GitHub petertecnetdev/petertecnet.com.br/ecosystem-coordination/README.md, PROTOCOL.md, CURRENT_STATE.md, PRIORITIES.md, BLOCKERS.md, claims/active/ e mensagens recentes relacionadas à sua frente.

Use um agent_id estável e exclusivo para esta tarefa, preferencialmente account-<NN>-<role>.

Antes de alterar código, crie um claim próprio conforme PROTOCOL.md. Se existir claim ativo sobre o mesmo escopo, não duplique trabalho: faça handoff/coordenação por arquivo em ecosystem-coordination/messages/.

Ao terminar, registre commit/PR/checks, feche ou mova o claim para claims/completed/, atualize seu worklog em ecosystem-coordination/agents/<agent-id>/worklog.md e envie handoffs necessários.

Nunca grave tokens, senhas, chaves, credenciais ou outros segredos no repositório de coordenação.
```

## Regra de adoção
A primeira execução de cada agente deve criar:
- `agents/<agent-id>/status.md`
- `agents/<agent-id>/worklog.md`

Depois disso, todo ciclo deve usar claims e handoffs.

## Objetivo
Fazer todas as contas funcionarem como uma única equipe distribuída, com GitHub como memória operacional compartilhada e fonte de evidência.
