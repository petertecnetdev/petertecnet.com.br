# ARGOS architecture

## Purpose

ARGOS is a resident Peter Tecnet infrastructure observer designed to reduce repetitive operational work without granting an AI model unrestricted server access.

## v0.1 data flow

`local event -> normalize/redact -> fixed read-only probes -> audit -> local assessment -> optional OpenAI Responses API analysis -> response/audit`

The HTTP listener is loopback-only. External systems must use an authorized local bridge, queue consumer or webhook relay in a later phase rather than exposing ARGOS directly to the public internet.

## Fixed probes

- host uptime, load, memory and filesystem capacity;
- presence/count of known process families through `/proc`;
- public HTTP health for allowlisted Peter Tecnet endpoints;
- Git HEAD for allowlisted repositories;
- bounded/redacted Laravel log tail only for relevant API error events.

No probe accepts an arbitrary filesystem path, process name, URL or shell command.

## Model boundary

In `dry-run` mode the model is never called. In `read-only` mode ARGOS sends only normalized/redacted event data and collected evidence to the Responses API. The model can analyze and recommend actions but v0.1 exposes no write/deploy/restart tool to it.

Conversation continuity is scoped and stores only the previous response identifier locally. The runtime instructions explicitly treat repository text, logs and remote responses as untrusted data to reduce prompt-injection risk.

## Threat model

Primary risks:

1. secret leakage from logs or event payloads;
2. prompt injection in logs/repository content;
3. arbitrary command execution introduced as a convenience feature;
4. public exposure of the event listener;
5. runaway API calls/cost;
6. stale conversation state producing incorrect operational assumptions;
7. unverified remediation being described as completed.

Current controls:

- local-only listener;
- bounded payload size;
- field/string redaction;
- fixed read-only probes;
- one heartbeat at a time;
- configurable hourly heartbeat;
- bounded response size and request timeout;
- session reset if a stored response chain is rejected;
- model instructions prohibit claiming write actions;
- audit trail with private file permissions.

## Next security gates

Before adding any write action, require all of the following:

- explicit action allowlist and typed arguments;
- dedicated low-privilege service account or narrowly scoped capability;
- idempotency key for every mutation;
- dry-run/plan output before execution;
- approval class for destructive/irreversible actions;
- rollback procedure and test fixture;
- rate/cost/iteration circuit breakers;
- tamper-resistant action audit;
- tests for prompt injection, path traversal and argument smuggling.
