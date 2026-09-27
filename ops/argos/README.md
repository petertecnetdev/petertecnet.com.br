# ARGOS

ARGOS is the Peter Tecnet resident infrastructure observer. Version 0.1 starts deliberately in read-only/dry-run mode: it receives local events, collects bounded operational evidence, records an audit trail and can send the redacted evidence to the OpenAI Responses API when a runtime credential is configured.

## Security model

- HTTP server binds to `127.0.0.1` by default and rejects non-loopback callers.
- No arbitrary shell or command execution exists in v0.1.
- Probes are fixed: process presence, memory/load/disk, selected public HTTP endpoints, allowlisted Git HEADs and a bounded API log tail for relevant error events.
- Sensitive-looking fields and inline assignments are redacted before audit/model use.
- The model cannot restart services, deploy, edit files or execute commands in this version.
- State/audit files are created with user-only permissions.

## Runtime

```bash
cd ops/argos
npm install --ignore-scripts
npm test
npm run once
npm start
```

Default local endpoints:

- `GET http://127.0.0.1:8791/health`
- `POST http://127.0.0.1:8791/tick`
- `POST http://127.0.0.1:8791/events`

Example event:

```json
{
  "source": "cutinapp",
  "type": "checkout_error",
  "severity": "error",
  "scope": "cutinapp-checkout",
  "project": "api",
  "summary": "Checkout error rate alert from an authorized local monitor.",
  "context": {"request_id": "example"}
}
```

## Model activation

Keep `ARGOS_MODE=dry-run` until local evidence is validated. To enable read-only model analysis, place the model credential only in the private runtime environment, set `ARGOS_MODE=read-only`, and restart the user service. Never commit the credential.

The model and API base are configurable with `ARGOS_OPENAI_MODEL` and `ARGOS_OPENAI_BASE_URL`. Conversation continuity uses `previous_response_id` persisted per scope under the private ARGOS state directory.

## Rollout path

1. dry-run observer;
2. read-only model analysis;
3. signed/local event integrations from deploy/monitoring jobs;
4. reversible write actions behind explicit allowlists and approvals;
5. deploy/restart actions only after threat-model review, tests and rollback controls.
