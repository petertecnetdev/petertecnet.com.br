import fs from 'node:fs/promises';
import path from 'node:path';
import { redact } from './redact.mjs';

async function ensureStateDir(config) {
  await fs.mkdir(config.stateDir, { recursive: true, mode: 0o700 });
}

export async function appendAudit(config, type, payload = {}) {
  await ensureStateDir(config);
  const record = { at: new Date().toISOString(), type, payload: redact(payload) };
  await fs.appendFile(path.join(config.stateDir, 'audit.jsonl'), `${JSON.stringify(record)}\n`, { mode: 0o600 });
}

function sessionPath(config, scope) {
  const safe = String(scope || 'default').replace(/[^a-zA-Z0-9_.-]/g, '_').slice(0, 80);
  return path.join(config.stateDir, `session-${safe}.json`);
}

export async function loadSession(config, scope) {
  await ensureStateDir(config);
  try {
    const parsed = JSON.parse(await fs.readFile(sessionPath(config, scope), 'utf8'));
    return typeof parsed.previousResponseId === 'string' ? parsed : {};
  } catch (error) {
    if (error?.code === 'ENOENT') return {};
    throw error;
  }
}

export async function saveSession(config, scope, previousResponseId) {
  await ensureStateDir(config);
  const target = sessionPath(config, scope);
  const temp = `${target}.tmp`;
  const data = { previousResponseId, updatedAt: new Date().toISOString() };
  await fs.writeFile(temp, `${JSON.stringify(data)}\n`, { mode: 0o600 });
  await fs.rename(temp, target);
}
