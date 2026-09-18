# Peter Tecnet Agent Control Protocol v2

Este protocolo coordena as contas externas do ChatGPT que trabalham no ecossistema Peter Tecnet. **Agentes são contas do ChatGPT; plataformas são apenas contexto de trabalho.**

## 1. Identidade
Cada execução deve conhecer um único `agent_id` cadastrado em `.agents/AGENTS_REGISTRY.json`. Nunca use Cutinapp, API, Nexus, Plat etc. como identidade do agente.

## 2. Bootstrap obrigatório
Antes de qualquer trabalho:
1. leia `.agents/AGENTS_REGISTRY.json`;
2. leia `.agents/CURRENT_STATE.md`;
3. leia `.agents/DECISIONS.md`;
4. leia seu arquivo `.agents/state/<AGENT_ID>.json`;
5. leia as mensagens novas em `.agents/AGENT_CHAT.md` destinadas a `@todos` ou `@<AGENT_ID>`;
6. liste `.agents/tasks/` e priorize tarefas atribuídas ao seu agente;
7. atualize seu state para `READING` e depois `RUNNING` quando assumir trabalho.

## 3. Prioridade
1. comando explícito de OWNER/Pedro;
2. CRITICAL;
3. segurança, disponibilidade, pagamentos e risco de perda de receita;
4. HIGH;
5. tarefas já RUNNING;
6. NORMAL;
7. LOW.

## 4. Tarefas
Cada tarefa é um arquivo JSON em `.agents/tasks/TASK-*.json`.
Estados permitidos: NEW, ASSIGNED, RUNNING, WAITING, REVIEW, DONE, BLOCKED, NEEDS_OWNER_DECISION, CANCELLED.

Para assumir:
- leia o SHA atual;
- confirme que o lock está livre ou expirado;
- defina `owner_agent_id`, `lock_acquired_at`, `lock_expires_at`, `status=RUNNING`;
- incremente `version`;
- nunca sobrescreva atualização concorrente.

Se o lock estiver ativo em outro agente, não duplique o trabalho.

## 5. Lock e expiração
Lock padrão: 90 minutos. O agente renova o lock ao registrar progresso. Lock expirado pode ser assumido por outro agente, registrando o motivo no histórico da tarefa.

## 6. Delegação
Máximo padrão: 2 delegações. Cada repasse incrementa `delegation_count`. Ao atingir o limite, use `NEEDS_OWNER_DECISION`. Nunca crie loops entre agentes.

## 7. Chat
O chat é append-only. Mensagens devem conter:
- destinatário: @todos, @NPxx ou @OWNER;
- contexto: plataforma/repositório, quando houver;
- tarefa: TASK-id, quando houver;
- prioridade;
- status;
- evidência/commit quando aplicável.

Responda a uma ordem com RECEIVED/START e depois DONE/BLOCKED/REVIEW. Não deixe uma ordem lida sem estado.

## 8. Heartbeat e recibos
No início e no final de toda execução atualize `.agents/state/<AGENT_ID>.json`:
- `last_seen_at`;
- `last_read_at`;
- `last_read_message_id`;
- `read_message_ids` (mantenha no máximo os 200 IDs mais recentes realmente lidos);
- `received_task_ids` (tarefas efetivamente recebidas);
- `status`;
- `current_task_id`;
- `run_id`, `run_started_at`, `run_finished_at` e `heartbeat_seq`;
- `checkpoint`;
- `next_action`;
- `last_commit`;
- `last_error`.

Ao ler uma mensagem com `Mensagem-ID`, acrescente o ID em `read_message_ids`. Ao confirmar uma tarefa, acrescente o `task_id` em `received_task_ids`.

## 9. Checkpoint
Antes de encerrar uma execução, sempre registre:
- o que foi concluído;
- onde parou;
- próximo passo exato;
- arquivos/commits relevantes;
- bloqueios;
- testes executados.

A próxima execução continua desse checkpoint; não reinicie a análise do zero.

## 10. Evidência para DONE
DONE exige ao menos uma evidência verificável quando houver alteração técnica: commit, PR, teste, build, endpoint validado, workflow ou relatório. Sem evidência, use REVIEW/WAITING.

## 11. Revisão
Mudanças CRITICAL, pagamentos, segurança e produção devem preferencialmente passar por outro agente (NP03 para QA; NP04 para segurança quando aplicável). O revisor não deve ser o mesmo agente que implementou.

## 12. Decisões
Decisões duradouras entram em `.agents/DECISIONS.md`. Não reverta decisão aceita sem registrar proposta de substituição e motivo.

## 13. Bloqueios
Bloqueio relevante entra em `.agents/BLOCKERS.md` e na tarefa. Se exigir decisão humana, use `NEEDS_OWNER_DECISION` e mencione @OWNER.

## 14. Segurança
Nunca grave senha, token, chave privada, cookie, segredo de webhook ou credencial no chat, state, tasks, commits ou logs públicos.

## 15. Continuidade
As tarefas programadas não devem tentar criar ciclos artificiais para contornar limites da plataforma. A continuidade é feita pelo checkpoint e pela próxima execução autorizada.

## 16. Encerramento obrigatório
Antes de terminar:
1. atualize a tarefa;
2. publique mensagem de resultado no Agent Chat;
3. atualize seu state;
4. leia novamente o chat para dependências novas;
5. deixe `next_action` explícito.


## 17. Coordenação
NP09 é o coordenador operacional inicial. Pode identificar duplicidade, propor atribuição, pedir revisão e consolidar estado, mas não substitui uma ordem do OWNER. Conflitos técnicos sem consenso devem virar `NEEDS_OWNER_DECISION` quando bloquearem avanço.

## 18. Inbox
Cada agente possui `.agents/inbox/<AGENT_ID>.md`, gerado automaticamente a partir do chat. Use a inbox para localizar mensagens relevantes rapidamente, mas o `AGENT_CHAT.md` continua sendo o histórico completo.

## 19. Estados visíveis
O Admin Center pode derivar `SENT/SYNCED/READ/CLAIMED/RUNNING/DONE/BLOCKED` usando mensagem, state e tarefa. Nunca marque DONE apenas para encerrar uma execução.
