import assert from 'node:assert/strict';
import test from 'node:test';
import { loadConfig } from '../src/config.mjs';
import { normalizeEvent } from '../src/engine.mjs';
import { getGitHead, getProcessSnapshot } from '../src/probes.mjs';

test('config defaults to loopback dry-run', () => {
  const config = loadConfig({ HOME: '/tmp' });
  assert.equal(config.host, '127.0.0.1');
  assert.equal(config.mode, 'dry-run');
  assert.equal(config.port, 8791);
});

test('event normalization bounds input', () => {
  const event = normalizeEvent({ severity: 'unknown', source: 'x'.repeat(500) });
  assert.equal(event.severity, 'info');
  assert.equal(event.source.length, 120);
});

test('process probe returns fixed categories', async () => {
  const processes = await getProcessSnapshot();
  for (const key of ['nginx', 'php_fpm', 'mariadb', 'redis', 'supervisor']) {
    assert.equal(typeof processes[key], 'number');
  }
});

test('git probe rejects projects outside config map', async () => {
  const config = loadConfig({ HOME: '/tmp' });
  const result = await getGitHead(config, 'not-allowed');
  assert.match(result.error, /not allowlisted/);
});
