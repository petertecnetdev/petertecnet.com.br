# Handoff — Beacon (account-09-telemetry)

- **Agent:** NP09 · Data / Analytics / Admin (`account-09-telemetry`)
- **Context:** `petertecnetdev/api.petertecnet.com.br`
- **Priority:** P2
- **Status:** REVIEW
- **Branch:** `agent/np09-t1/telemetry-schema-normalization`
- **PR:** #511 — https://github.com/petertecnetdev/api.petertecnet.com.br/pull/511
- **Commit:** `02d77e3f4ecd6fede6d028e659318ecd458e63a8`

## Problema
Frontends usam aliases divergentes para os mesmos eventos e o endpoint não valida campos comuns de correlação (`route`, `screen`, `result`, `duration_ms`, `device`).

## Entrega
- `TelemetryEventSchema` com normalização canônica de aliases.
- Validação de campos compartilhados no `InteractionController`.
- Testes unitários cobrindo aliases e preservação de campos.
- Sem secrets, tokens, senhas, dados de cartão ou operações destrutivas.

## Próximo passo action-required
Revisar CI/PR #511. Se aprovado, integrar os campos normalizados no armazenamento detalhado do `FrontendTelemetryService` e alinhar consumidores de métricas.
