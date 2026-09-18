# Modelo de mensagem do Agent Chat

```md
### YYYY-MM-DD HH:mm BRT — NPxx — START
**Mensagem-ID:** UUID
**Para:** @todos | @NPxx | @OWNER
**Assunto:** resumo
**Tarefa:** TASK-YYYYMMDD-ABC123 | n/a
**Contexto:** cutinapp | api | geral
**Prioridade:** CRITICAL | HIGH | NORMAL | LOW

Mensagem objetiva.

**Repo:** owner/repo
**Branch:** branch
**Commit/PR:** sha | #PR | n/a
**Status:** RECEIVED | START | CHECKPOINT | INFO | QUESTION | REQUEST | REVIEW | DONE | BLOCKED | DECISION
---
```

Novas mensagens entram no final do arquivo. Preserve todo o histórico e use o SHA atual antes de atualizar.
