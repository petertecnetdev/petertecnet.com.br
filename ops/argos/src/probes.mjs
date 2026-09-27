import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { redactString } from './redact.mjs';

export async function getServerSnapshot(config) {
  let disk = null;
  try {
    const stats = await fs.statfs(config.projects.petertecnet);
    disk = { total_bytes: stats.blocks * stats.bsize, free_bytes: stats.bavail * stats.bsize };
  } catch (error) {
    disk = { error: redactString(error.message) };
  }
  return {
    hostname: os.hostname(),
    uptime_seconds: Math.round(os.uptime()),
    loadavg: os.loadavg(),
    memory: { total_bytes: os.totalmem(), free_bytes: os.freemem() },
    disk,
  };
}

const PROCESS_MATCHES = {
  nginx: ['nginx'],
  php_fpm: ['php-fpm', 'php-fpm8.3'],
  mariadb: ['mariadbd', 'mysqld'],
  redis: ['redis-server'],
  supervisor: ['supervisord'],
};

export async function getProcessSnapshot() {
  const entries = await fs.readdir('/proc', { withFileTypes: true });
  const counts = Object.fromEntries(Object.keys(PROCESS_MATCHES).map((key) => [key, 0]));
  for (const entry of entries) {
    if (!entry.isDirectory() || !/^\d+$/.test(entry.name)) continue;
    try {
      const comm = (await fs.readFile(`/proc/${entry.name}/comm`, 'utf8')).trim().toLowerCase();
      for (const [key, needles] of Object.entries(PROCESS_MATCHES)) {
        if (needles.some((needle) => comm.includes(needle))) counts[key] += 1;
      }
    } catch {
      // Processes can exit between readdir and readFile.
    }
  }
  return counts;
}

export async function checkHttpTarget(config, target) {
  const url = config.healthTargets[target];
  if (!url) return { target, error: 'target not allowlisted' };
  const started = Date.now();
  try {
    const response = await fetch(url, {
      method: 'GET', redirect: 'follow', signal: AbortSignal.timeout(config.toolTimeoutMs),
      headers: { 'user-agent': 'PeterTecnet-Argos/0.1' },
    });
    await response.body?.cancel();
    return { target, status: response.status, ok: response.ok, elapsed_ms: Date.now() - started };
  } catch (error) {
    return { target, ok: false, error: redactString(error.message), elapsed_ms: Date.now() - started };
  }
}

export async function getGitHead(config, project) {
  const root = config.projects[project];
  if (!root) return { project, error: 'project not allowlisted' };
  try {
    const head = (await fs.readFile(path.join(root, '.git', 'HEAD'), 'utf8')).trim();
    if (!head.startsWith('ref: ')) return { project, head };
    const ref = head.slice(5);
    const sha = (await fs.readFile(path.join(root, '.git', ref), 'utf8')).trim();
    return { project, ref, head: sha };
  } catch (error) {
    return { project, error: redactString(error.message) };
  }
}

export async function readApiLogTail(config, lines = 80) {
  const filePath = config.appLogs.api_laravel;
  try {
    const stat = await fs.stat(filePath);
    const bytes = Math.min(stat.size, 65536);
    const handle = await fs.open(filePath, 'r');
    try {
      const buffer = Buffer.alloc(bytes);
      await handle.read(buffer, 0, bytes, Math.max(0, stat.size - bytes));
      return redactString(buffer.toString('utf8').split('\n').slice(-Math.min(lines, 120)).join('\n'));
    } finally {
      await handle.close();
    }
  } catch (error) {
    return `log unavailable: ${redactString(error.message)}`;
  }
}
