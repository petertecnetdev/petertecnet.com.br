# Coordination Protocol

## 1. Leitura obrigatória
Todo ciclo começa lendo:
- `CURRENT_STATE.md`
- `PRIORITIES.md`
- `BLOCKERS.md`
- `claims/active/`
- mensagens recentes relacionadas ao projeto/frente

## 2. Claim
Crie um arquivo em:
`claims/active/YYYYMMDD-HHMM-<agent-id>-<slug>.md`

Formato:

```md
# Claim
agent: <agent-id>
repository: <owner/repo>
area: <área funcional>
task: <objetivo>
branch: <branch ou TBD>
status: working
started_at: <ISO-8601>
depends_on: <PR/claim/none>
files_or_scope:
- <caminho/área>

## Notes
<contexto curto>
```

Um agente não deve iniciar trabalho sobre o mesmo escopo de outro claim ativo sem antes fazer handoff explícito.

## 3. Implementação
- preservar trabalho recente;
- trabalhar em branch/PR quando apropriado;
- nunca force-push;
- respeitar branch protection;
- evitar alterações destrutivas;
- manter a API central genérica e reutilizável;
- verificar dependências entre frontend/backend.

## 4. Handoff
Mensagens devem ser arquivos independentes:
`messages/YYYYMMDD-HHMM-<from>-to-<to>-<slug>.md`

Formato:

```md
# Handoff
from: <agent-id>
to: <agent-id ou role>
repository: <owner/repo>
related_pr: <# ou none>
priority: P0|P1|P2|P3
status: action-required|informational

## Context
...

## Requested action
...

## Evidence
- commit:
- PR:
- checks:
```

## 5. Encerramento do claim
No final do ciclo:
- registrar commit/PR/checks no claim;
- marcar `status: completed`, `blocked` ou `handoff`;
- mover ou recriar o arquivo em `claims/completed/` quando concluído;
- remover o arquivo correspondente de `claims/active/` somente depois de existir registro concluído.

## 6. Bloqueios
Bloqueios compartilhados e de alto impacto entram em `BLOCKERS.md`, sempre com:
- impacto;
- repositório;
- evidência;
- responsável atual;
- próximo passo.

## 7. Prioridades
`PRIORITIES.md` é consolidado pela frente Tech Lead/Coordination. Outros agentes podem propor mudanças via mensagem, evitando reescritas concorrentes desse arquivo.

## 8. Segurança operacional
Nenhum arquivo de coordenação deve conter:
- tokens;
- senhas;
- chaves privadas;
- credenciais;
- dados pessoais desnecessários;
- segredos de produção.
