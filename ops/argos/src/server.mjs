import http from 'node:http';
import { loadConfig } from './config.mjs';
import { appendAudit } from './audit.mjs';
import { handleEvent } from './engine.mjs';

const config = loadConfig();
const startedAt = Date.now();

function json(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(body),
    'cache-control': 'no-store',
  });
  res.end(body);
}

function isLoopback(address = '') {
  return address === '127.0.0.1' || address === '::1' || address === '::ffff:127.0.0.1';
}

async function readJson(req) {
  let size = 0;
  const chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > config.maxEventBytes) throw new Error('event payload too large');
    chunks.push(chunk);
  }
  return chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {};
}

const server = http.createServer(async (req, res) => {
  try {
    if (!isLoopback(req.socket.remoteAddress)) return json(res, 403, { error: 'loopback only' });

    if (req.method === 'GET' && req.url === '/health') {
      return json(res, 200, {
        service: 'argos', version: '0.1.0', mode: config.mode,
        model: config.model, model_configured: Boolean(config.modelCredential),
        uptime_seconds: Math.round((Date.now() - startedAt) / 1000),
      });
    }

    if (req.method === 'POST' && (req.url === '/events' || req.url === '/tick')) {
      const body = req.url === '/tick'
        ? { source: 'argos', type: 'manual_tick', severity: 'info', summary: 'Manual observation requested.' }
        : await readJson(req);
      return json(res, 200, await handleEvent(config, body));
    }

    return json(res, 404, { error: 'not found' });
  } catch (error) {
    await appendAudit(config, 'request_error', { message: error?.message || String(error) });
    return json(res, 500, { error: 'internal error' });
  }
});

let heartbeatRunning = false;
async function heartbeat() {
  if (heartbeatRunning) return;
  heartbeatRunning = true;
  try {
    await handleEvent(config, {
      source: 'argos', type: 'heartbeat', severity: 'info', scope: 'infrastructure',
      summary: 'Scheduled infrastructure observation.',
    });
  } catch (error) {
    await appendAudit(config, 'heartbeat_error', { message: error?.message || String(error) });
  } finally {
    heartbeatRunning = false;
  }
}

server.listen(config.port, config.host, async () => {
  await appendAudit(config, 'service_started', { host: config.host, port: config.port, mode: config.mode });
  heartbeat();
});

if (config.heartbeatMinutes > 0) {
  const timer = setInterval(heartbeat, config.heartbeatMinutes * 60_000);
  timer.unref();
}

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => server.close(() => process.exit(0)));
}
