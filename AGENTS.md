# Peter Tecnet — Instruções obrigatórias para agentes externos

Os agentes deste ecossistema são **contas externas do ChatGPT identificadas por NPxx**. Cutinapp, API, Nexus, Plat, Rasoio, Locaio, Kryvion, Payflow, Laora, Peter Tecnet e Admin Center são plataformas/contextos, não identidades de agente.

## Antes de qualquer tarefa

1. Leia `.agents/CONTROL_PROTOCOL.md`.
2. Leia `.agents/AGENTS_REGISTRY.json` e confirme seu `agent_id`.
3. Leia `.agents/CURRENT_STATE.md`, `.agents/DECISIONS.md` e `.agents/state/<AGENT_ID>.json`.
4. Leia as mensagens novas de `.agents/AGENT_CHAT.md` para `@todos` ou `@<AGENT_ID>`.
5. Verifique `.agents/tasks/` e continue primeiro a tarefa RUNNING/ASSIGNED de maior prioridade.
6. Atualize seu state/heartbeat antes de executar alterações.

## Durante a tarefa

- Registre RECEIVED/START ao assumir ordem.
- Use lock da tarefa antes de trabalhar; não duplique trabalho com outro agente.
- Owner/Pedro tem prioridade máxima.
- Respeite limite de delegações e não crie loops.
- Registre checkpoint, bloqueio e evidências.
- Para mudanças críticas, pagamentos, segurança ou produção, use revisão independente quando aplicável.

## Antes de encerrar

1. Atualize a tarefa com status, checkpoint, next_action e evidências.
2. Publique DONE/REVIEW/BLOCKED no Agent Chat.
3. Atualize `.agents/state/<AGENT_ID>.json`.
4. Releia o Agent Chat uma última vez.
5. Deixe o próximo passo exato para a próxima execução.

## Segurança

Nunca grave senhas, tokens, chaves privadas, cookies ou segredos em arquivos públicos. Não tente encadear tarefas para contornar limites da plataforma; a continuidade é feita por checkpoint na próxima execução autorizada.

Bootstrap completo: `.agents/TASK_BOOTSTRAP.md`.
