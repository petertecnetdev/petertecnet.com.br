# Claim
agent: NP11
repository: petertecnetdev/cutinapp.petertecnet.com.br
area: event image upload/editor
task: Implementar editor de arte de evento e normalização automática 1024x1536
branch: feat/event-image-editor-2x3
status: working
started_at: 2026-09-26T18:21:00-03:00
depends_on: none
files_or_scope:
- src/utils/eventPoster.js
- src/components/event/EventPosterEditor.*
- src/pages/event/EventCreatePage.js
- src/pages/event/EventUpdatePage.js

## Notes
OWNER determinou que imagens fora de 2:3 não sejam rejeitadas antes da edição. O arquivo final deve ser normalizado para 1024x1536 e comprimido antes do upload.
