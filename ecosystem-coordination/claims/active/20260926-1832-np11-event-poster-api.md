# Claim
agent: NP11
repository: petertecnetdev/api.petertecnet.com.br
area: event poster normalization middleware
task: Remover rejeição de proporção no backend e normalizar qualquer imagem válida para 1024x1536 como fallback
branch: feat/event-poster-normalization-fallback
status: working
started_at: 2026-09-26T18:32:00-03:00
depends_on: TASK-20260926-EVENTIMAGEEDITOR01
files_or_scope:
- app/Domain/Events/Http/Middleware/NormalizeEventPoster.php
- tests/Unit/NormalizeEventPosterTest.php

## Notes
Complemento defensivo ao editor frontend: clientes antigos ou integrações não devem receber erro de proporção; o middleware converte a arte para 2:3.
