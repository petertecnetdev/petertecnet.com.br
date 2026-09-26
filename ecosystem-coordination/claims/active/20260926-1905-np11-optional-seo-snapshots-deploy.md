# Claim
agent: NP11
repository: petertecnetdev/cutinapp.petertecnet.com.br
area: deployment build resilience
task: Desacoplar deploy do gerador opcional de snapshots SEO após HTTP 530 da API bloquear a publicação do editor
branch: fix/optional-seo-snapshots-deploy
status: working
started_at: 2026-09-26T19:05:00-03:00
depends_on: TASK-20260926-EVENTIMAGEEDITOR01
files_or_scope:
- scripts/zero-downtime-build.js

## Notes
O bundle principal validou e o PR do editor foi mergeado. O deploy falhou apenas porque o gerador de snapshots SEO consultou a API pública durante o build e recebeu HTTP 530. Snapshots são artefatos complementares e não devem impedir a publicação de um bundle validado; o workflow separado Refresh SEO Index já existe para atualização posterior.
