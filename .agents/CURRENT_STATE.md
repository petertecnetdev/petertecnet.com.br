# Peter Tecnet — Current State

Última atualização: 2026-09-18 13:48 BRT

## Comunicação dos agentes

- Canal central: `petertecnetdev/petertecnet.com.br/.agents/AGENT_CHAT.md`
- Regras: `petertecnetdev/petertecnet.com.br/AGENTS.md`
- Todo agente deve ler o chat e este estado antes de iniciar uma tarefa.
- Todo agente deve registrar START e o resultado final no chat.
- Mudanças globais relevantes devem atualizar este arquivo.

## Objetivo operacional atual

Manter continuidade entre contas/agentes e permitir que ordens, sugestões, bloqueios, commits, revisões e resultados sejam visíveis em um único histórico compartilhado no GitHub.

## Estado

- Agent Chat: ATIVO
- Protocolo central: ATIVO
- API: CONECTADA
- Cutinapp: CONECTADA
- Nexus: CONECTADA
- Plat: CONECTADA
- Rasoio: CONECTADA
- Locaio: CONECTADA
- Payflow: CONECTADA
- Laora: CONECTADA


## Admin Center Agent Chat

- Interface: PUBLICADA em `admincenter.petertecnet.com.br`
- Leitura do `.agents/AGENT_CHAT.md`: ATIVA E VALIDADA
- Atualização automática: ATIVA
- Endpoint GET/POST: ATIVO E PROTEGIDO pelo middleware administrativo
- Envio pelo Admin Center: ATIVO
- Sem PAT: mensagens entram em fila local e são sincronizadas pelo workflow `Agent Chat Sync`
- Com `AGENT_CHAT_GITHUB_TOKEN`: gravação direta fica disponível automaticamente
- Segurança: nenhuma credencial GitHub é necessária no navegador; tokens opcionais permanecem somente no backend

- Agent Chat Sync: ATIVO E VALIDADO PONTA A PONTA
- Commits exclusivos de `.agents/**` não disparam o deploy geral do site

<!-- AUTO-STATE:START -->
## Snapshot operacional automático

- Agentes registrados: **8**
- Tarefas abertas: **6**
- Executando: **0**
- Em revisão: **4**
- Bloqueadas/decisão: **0**

### Agentes
- **NP01** · REVIEW · task: TASK-20260919-NEARBY01 · last_seen: 2026-09-19T11:23:00-03:00 · next: NP03 revisar PRs #578 e #506. Após aprovação, mergear e validar deploy/endpoint em produção.
- **NP02** · REVIEW · task: TASK-20260919-PRODEDIT01 · last_seen: 2026-09-19T12:33:00-03:00 · next: Aguardar QA NP03; após APPROVED, mergear #582 em main. Se houver changes requested, corrigir na mesma branch e repetir CI.
- **NP03** · WAITING · task: — · last_seen: nunca · next: Executar o bootstrap obrigatório e verificar o Agent Chat.
- **NP04** · WAITING · task: — · last_seen: nunca · next: Executar o bootstrap obrigatório e verificar o Agent Chat.
- **NP05** · REVIEW · task: TASK-20260919-MOBILE250 · last_seen: 2026-09-19T10:44:00-03:00 · next: NP03 executar revisão independente mobile em 360/390/430px, navegação, Event Manager, bottom sheets, teclado, rede limitada e overlays; aprovar ou solicitar mudanças antes de merge em main.
- **NP08** · WAITING · task: — · last_seen: nunca · next: Executar o bootstrap obrigatório e verificar o Agent Chat.
- **NP09** · REVIEW · task: TELEMETRY-SCHEMA-NORMALIZATION · last_seen: 2026-09-20T17:20:00-03:00 · next: Aguardar CI e revisão NP03/Tech Lead no PR #511; depois corrigir feedback ou abrir handoff para integração dos novos campos no FrontendTelemetryService.
- **NP10** · BLOCKED · task: TAREFA-3-ADMIN-460 · last_seen: 2026-09-20T21:36:44-03:00 · next: Aguardar handoff/encerramento do claim NP09; então auditar main atual e validar 1-460, começando pelos gaps dos PRs #109/#114 e checks #108-#116.

### Próximas tarefas
- **TASK-20260918-7C211A** · HIGH · REVIEW · NP02 · cutinapp · Evoluir Meus eventos da Cutinapp — pacote 1–211
- **TASK-20260919-MOBILE250** · HIGH · REVIEW · NP05 · cutinapp · Simplificação e performance mobile Cutinapp — pacote 1–250
- **TASK-20260919-NEARBY01** · HIGH · REVIEW · NP01 · cutinapp · Corrigir filtro Perto de mim na descoberta de eventos
- **TASK-20260919-PRODEDIT01** · HIGH · REVIEW · NP02 · cutinapp · Editor visual da produção com capa no topo
- **TASK-20260918-7C211A-QA** · HIGH · ASSIGNED · NP03 · cutinapp · QA — Meus eventos Cutinapp pacote 1–211
- **TASK-20260919-E71A9F** · HIGH · WAITING · NP02 · cutinapp · Imagem automática de evento por IA com fallback de iniciais
<!-- AUTO-STATE:END -->
