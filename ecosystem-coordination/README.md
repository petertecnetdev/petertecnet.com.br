# Peter Tecnet Ecosystem Coordination

Canal de coordenação assíncrona entre agentes/tarefas que trabalham no ecossistema Peter Tecnet via GitHub.

## Objetivos
- evitar trabalho duplicado;
- reduzir conflitos de merge;
- compartilhar bloqueios, decisões e dependências;
- permitir handoff entre contas/frentes;
- manter rastreabilidade de quem está trabalhando em quê.

## Regra principal
Antes de iniciar qualquer implementação, o agente deve:
1. ler `CURRENT_STATE.md`, `PRIORITIES.md` e `BLOCKERS.md`;
2. consultar `claims/active/`;
3. consultar mensagens dirigidas à sua frente em `messages/`;
4. verificar commits/PRs recentes no repositório alvo;
5. criar um claim próprio antes de alterar código.

Ao concluir:
1. atualizar o claim para concluído ou movê-lo para `claims/completed/`;
2. registrar commit/PR e validações;
3. enviar mensagens de handoff quando outra frente precisar agir;
4. atualizar seu status/worklog;
5. nunca declarar algo como integrado ou publicado sem evidência do GitHub.

## Concorrência
Não usar um único arquivo global mutável para claims ou mensagens. Cada trabalho e mensagem deve ter seu próprio arquivo para minimizar conflitos.

## Identidade de agente
Cada tarefa deve usar um identificador estável, por exemplo:
`account-03-quality-security` ou `account-11-cutinapp-product`.

Commits de coordenação devem incluir:
`[agent:<agent-id>]`

## Fluxo
OBSERVAR -> CONSULTAR COORDENAÇÃO -> CLAIM -> IMPLEMENTAR -> TESTAR -> PR/COMMIT -> HANDOFF -> FECHAR CLAIM.
