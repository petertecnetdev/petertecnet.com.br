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
- Kryvion: CONECTADA
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
- Tarefas abertas: **0**
- Executando: **0**
- Em revisão: **0**
- Bloqueadas/decisão: **0**

### Agentes
- **NP01** · WAITING · task: — · last_seen: nunca · next: Executar o bootstrap obrigatório e verificar o Agent Chat.
- **NP02** · WAITING · task: — · last_seen: nunca · next: Executar o bootstrap obrigatório e verificar o Agent Chat.
- **NP03** · WAITING · task: — · last_seen: nunca · next: Executar o bootstrap obrigatório e verificar o Agent Chat.
- **NP04** · WAITING · task: — · last_seen: nunca · next: Executar o bootstrap obrigatório e verificar o Agent Chat.
- **NP05** · WAITING · task: — · last_seen: nunca · next: Executar o bootstrap obrigatório e verificar o Agent Chat.
- **NP08** · WAITING · task: — · last_seen: nunca · next: Executar o bootstrap obrigatório e verificar o Agent Chat.
- **NP09** · WAITING · task: — · last_seen: nunca · next: Executar o bootstrap obrigatório e verificar o Agent Chat.
- **NP10** · WAITING · task: — · last_seen: nunca · next: Executar o bootstrap obrigatório e verificar o Agent Chat.

### Próximas tarefas
- Nenhuma tarefa aberta.
<!-- AUTO-STATE:END -->
