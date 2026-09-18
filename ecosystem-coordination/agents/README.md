# Agents

Cada tarefa recorrente deve possuir um `agent-id` estável.

Sugestão:
`account-<NN>-<role>`

Exemplos de roles:
- intake-coordination
- architecture-product
- quality-security
- revenue-financial
- merge-release
- cutinapp
- nexus
- plat
- rasoio
- locaio
- laora
- api

Cada agente pode manter arquivos próprios sob:
`agents/<agent-id>/status.md`
`agents/<agent-id>/worklog.md`

Evite editar arquivos pertencentes a outro agente.
