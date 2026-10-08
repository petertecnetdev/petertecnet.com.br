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

- Agentes registrados: **9**
- Tarefas abertas: **24**
- Executando: **2**
- Em revisão: **17**
- Bloqueadas/decisão: **0**

### Agentes
- **NP01** · REVIEW · task: TASK-20260919-NEARBY01 · last_seen: 2026-09-19T11:23:00-03:00 · next: NP03 revisar PRs #578 e #506. Após aprovação, mergear e validar deploy/endpoint em produção.
- **NP02** · REVIEW · task: TASK-20260926-NAVINSTAGRAM01 · last_seen: 2026-09-26T12:18:00-03:00 · next: Wait for Validate Cutinapp + Lighthouse CI; merge #641 if green and perform post-merge production/local visual validation.
- **NP03** · REVIEW · task: TASK-20260928-EVENTVIEWSYMMETRY01 · last_seen: 2026-09-28T07:16:00-03:00 · next: Confirmar resultado do retry do Deploy VPS e release pública; solicitar/recolher review visual NP11; depois retomar TASK-20260927-DMEM01 do checkpoint anterior.
- **NP04** · WAITING · task: — · last_seen: nunca · next: Executar o bootstrap obrigatório e verificar o Agent Chat.
- **NP05** · REVIEW · task: TASK-20260919-MOBILE250 · last_seen: 2026-09-19T10:44:00-03:00 · next: NP03 executar revisão independente mobile em 360/390/430px, navegação, Event Manager, bottom sheets, teclado, rede limitada e overlays; aprovar ou solicitar mudanças antes de merge em main.
- **NP08** · WAITING · task: — · last_seen: nunca · next: Executar o bootstrap obrigatório e verificar o Agent Chat.
- **NP09** · BLOCKED · task: ADMIN-460-DIALOG-A11Y · last_seen: 2026-10-03T17:09:33-03:00 · next: Aplicar aria-hidden=true ao segundo ícone em AccountAccessPage.jsx quando a API permitir nova escrita segura; então executar/aguardar CI, registrar REVIEW e atualizar PR #132.
- **NP10** · BLOCKED · task: TAREFA-3-ADMIN-460 · last_seen: 2026-09-20T21:36:44-03:00 · next: Aguardar handoff/encerramento do claim NP09; então auditar main atual e validar 1-460, começando pelos gaps dos PRs #109/#114 e checks #108-#116.
- **NP11** · REVIEW · task: TASK-20261007-BRANDPALETTE01 · last_seen: 2026-10-07T19:12:00-03:00 · next: Aguardar revisão visual NP03; sem merge/deploy automático desta tarefa.

### Próximas tarefas
- **TASK-20260927-DMEM01** · CRITICAL · RUNNING · NP03 · cutinapp · Corrigir Direct da Cutinapp e notificar novas mensagens por email
- **TASK-20260926-EVENTIMAGEEDITOR01** · HIGH · RUNNING · NP11 · cutinapp · Editor de imagem de evento estilo Instagram com normalização automática 2:3
- **TASK-20260928-EVENTVIEWSYMMETRY01** · CRITICAL · REVIEW · fila · geral · Cutinapp — corrigir simetria e hierarquia da view pública de evento
- **TASK-20260926-NAVINSTAGRAM01** · HIGH · REVIEW · fila · geral · Cutinapp — reorganizar navegação desktop no padrão Instagram
- **TASK-20260927-EVENTVIEWEVOLUTION01** · HIGH · REVIEW · fila · geral · Cutinapp — evolução contínua das views públicas, iniciando pela view de evento
- **TASK-20260927-FEEDMEDIA01** · HIGH · REVIEW · fila · geral · Cutinapp — publicações com mídia no Feed em experiência estilo Instagram
- **TASK-20260927-MEDIALIBRARY01** · HIGH · REVIEW · fila · geral · Peter Tecnet — Media Library central reutilizável + Admin Center
- **TASK-20260927-PROFILECOVERUPLOAD01** · HIGH · REVIEW · fila · geral · Cutinapp — corrigir capa e navegação persistente do editor de perfil
- **TASK-20261007-BRANDPALETTE01** · HIGH · REVIEW · fila · geral · Cutinapp — consolidar paleta oficial da logo e eliminar legado cromático
- **TASK-20260918-7C211A** · HIGH · REVIEW · NP02 · cutinapp · Evoluir Meus eventos da Cutinapp — pacote 1–211
- **TASK-20260919-MOBILE250** · HIGH · REVIEW · NP05 · cutinapp · Simplificação e performance mobile Cutinapp — pacote 1–250
- **TASK-20260919-NEARBY01** · HIGH · REVIEW · NP01 · cutinapp · Corrigir filtro Perto de mim na descoberta de eventos
- **TASK-20260919-PRODEDIT01** · HIGH · REVIEW · NP02 · cutinapp · Editor visual da produção com capa no topo
- **TASK-20260921-PRODFOLLOW01** · HIGH · REVIEW · NP02 · cutinapp · Seguimento estilo Instagram na página pública da produção
- **TASK-20260922-EVENTEDITOR01** · HIGH · REVIEW · NP02 · cutinapp · Aproximar create/edit de eventos da página pública e corrigir contraste dos botões
- **TASK-20260923-EVENTPUBLICRECOVERY01** · HIGH · REVIEW · NP02 · cutinapp · Corrigir falha transitória ao abrir evento público da Cutinapp
- **TASK-20260926-EVENTCARDS01** · HIGH · REVIEW · fila · geral · Cutinapp — evolução visual contínua da descoberta, listagem e cards de eventos
- **TASK-20260926-BLOGGROWTH01** · HIGH · REVIEW · fila · geral · Cutinapp — transformar blog em canal de aquisição e descoberta conectado ao ecossistema
- **TASK-20260926-EVENTADMINCONTROL01** · HIGH · REVIEW · fila · geral · Cutinapp — controles administrativos de ciclo de vida do evento na view pública
- **TASK-20260918-7C211A-QA** · HIGH · ASSIGNED · NP03 · cutinapp · QA — Meus eventos Cutinapp pacote 1–211
<!-- AUTO-STATE:END -->
