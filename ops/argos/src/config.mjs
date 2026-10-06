import os from 'node:os';
import path from 'node:path';

function intEnv(value, fallback, min, max) {
  const parsed = Number.parseInt(value ?? '', 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function parsePairs(raw) {
  return Object.fromEntries(String(raw ?? '').split(',').map((item) => item.trim()).filter(Boolean).map((item) => {
    const index = item.indexOf('=');
    return index < 1 ? [item, ''] : [item.slice(0, index).trim(), item.slice(index + 1).trim()];
  }).filter(([, value]) => value));
}

export function loadConfig(env = process.env) {
  const root = env.ARGOS_PROJECT_ROOT || '/var/www';
  const mode = ['dry-run', 'read-only'].includes(env.ARGOS_MODE) ? env.ARGOS_MODE : 'dry-run';
  const targets = 'petertecnet=https://petertecnet.com.br,cutinapp=https://cutinapp.petertecnet.com.br,api=https://api.petertecnet.com.br';
  return {
    host: env.ARGOS_HOST || '127.0.0.1',
    port: intEnv(env.ARGOS_PORT, 8791, 1024, 65535),
    mode,
    modelCredential: env.ARGOS_MODEL_API_KEY || '',
    model: env.ARGOS_OPENAI_MODEL || 'gpt-5.6-luna',
    apiBase: env.ARGOS_OPENAI_BASE_URL || 'https://api.openai.com/v1',
    ingestToken: env.ARGOS_INGEST_TOKEN || '',
    maxToolRounds: intEnv(env.ARGOS_MAX_TOOL_ROUNDS, 4, 1, 8),
    maxOutputTokens: intEnv(env.ARGOS_MAX_OUTPUT_TOKENS, 1200, 256, 4000),
    maxEventBytes: intEnv(env.ARGOS_MAX_EVENT_BYTES, 65536, 1024, 262144),
    toolTimeoutMs: intEnv(env.ARGOS_TOOL_TIMEOUT_MS, 5000, 500, 20000),
    heartbeatMinutes: intEnv(env.ARGOS_HEARTBEAT_MINUTES, 60, 0, 1440),
    stateDir: env.ARGOS_STATE_DIR || path.join(os.homedir(), '.local', 'state', 'argos'),
    healthTargets: parsePairs(env.ARGOS_HEALTH_TARGETS || targets),
    projects: {
      petertecnet: path.join(root, 'petertecnet.com.br'),
      cutinapp: path.join(root, 'cutinapp.petertecnet.com.br'),
      api: path.join(root, 'api.petertecnet.com.br'),
      admincenter: path.join(root, 'admincenter.petertecnet.com.br'),
      nexus: path.join(root, 'nexus.petertecnet.com.br'),
      payflow: path.join(root, 'payflow.petertecnet.com.br'),
      rasoio: path.join(root, 'rasoio.petertecnet.com.br'),
      plat: path.join(root, 'plat.petertecnet.com.br'),
    },
    services: ['nginx', 'php8.3-fpm', 'redis-server', 'mariadb', 'supervisor'],
    appLogs: { api_laravel: path.join(root, 'api.petertecnet.com.br', 'storage', 'logs', 'laravel.log') },
  };
}
