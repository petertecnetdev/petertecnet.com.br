import crypto from 'node:crypto';
import { appendAudit } from './audit.mjs';
import { analyzeEvidence } from './model.mjs';
import { redact, redactString } from './redact.mjs';
import { checkHttpTarget, getGitHead, getProcessSnapshot, getServerSnapshot, readApiLogTail } from './probes.mjs';

const SEVERITIES = new Set(['debug', 'info', 'warn', 'error', 'critical']);

export function normalizeEvent(raw = {}) {
  const severity = SEVERITIES.has(raw.severity) ? raw.severity : 'info';
  return {
    id: String(raw.id || crypto.randomUUID()).slice(0, 120),
    at: String(raw.at || new Date().toISOString()).slice(0, 80),
    source: redactString(raw.source || 'unknown', 120),
    type: redactString(raw.type || 'observation', 120),
    severity,
    summary: redactString(raw.summary || '', 3000),
    scope: redactString(raw.scope || raw.source || 'default', 120),
    project: typeof raw.project === 'string' ? raw.project.slice(0, 80) : null,
    context: redact(raw.context || {}),
  };
}

export async function collectEvidence(config, event) {
  const evidence = {
    server: await getServerSnapshot(config),
    processes: await getProcessSnapshot(),
    http: {},
  };

  for (const target of Object.keys(config.healthTargets)) {
    evidence.http[target] = await checkHttpTarget(config, target);
  }

  if (event.project && config.projects[event.project]) {
    evidence.git = await getGitHead(config, event.project);
  }

  const needsApiLog = ['error', 'critical'].includes(event.severity)
    && (event.project === 'api' || /api|checkout|payment|webhook/i.test(`${event.source} ${event.type}`));
  if (needsApiLog) evidence.api_log_tail = await readApiLogTail(config, 80);
  return redact(evidence);
}

function localAssessment(config, evidence) {
  const findings = [];
  for (const [name, count] of Object.entries(evidence.processes || {})) {
    if (count === 0) findings.push(`process:${name}:not-observed`);
  }
  for (const [name, result] of Object.entries(evidence.http || {})) {
    if (!result?.ok) findings.push(`http:${name}:${result?.status || 'failed'}`);
  }
  return {
    status: findings.length ? 'attention' : 'healthy-observation',
    findings,
    next: config.modelCredential
      ? 'Set ARGOS_MODE=read-only to enable model analysis.'
      : 'Configure ARGOS_MODEL_API_KEY securely, then set ARGOS_MODE=read-only.',
  };
}

export async function handleEvent(config, rawEvent) {
  const event = normalizeEvent(rawEvent);
  await appendAudit(config, 'event_received', event);
  const evidence = await collectEvidence(config, event);
  await appendAudit(config, 'evidence_collected', { event_id: event.id, evidence });

  if (config.mode === 'dry-run' || !config.modelCredential) {
    const assessment = localAssessment(config, evidence);
    await appendAudit(config, 'dry_run_completed', { event_id: event.id, assessment });
    return { status: 'dry-run', event, evidence, assessment, model_configured: Boolean(config.modelCredential) };
  }

  const model = await analyzeEvidence(config, event, evidence);
  return { status: 'analyzed', event, evidence, model };
}
