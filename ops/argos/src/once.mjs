import { loadConfig } from './config.mjs';
import { handleEvent } from './engine.mjs';

const config = loadConfig();
let event = {
  source: 'argos-cli',
  type: 'manual_observation',
  severity: 'info',
  scope: 'infrastructure',
  summary: 'Manual ARGOS observation requested from CLI.',
};

if (process.argv[2]) {
  try {
    event = JSON.parse(process.argv[2]);
  } catch {
    console.error('Argument must be valid JSON.');
    process.exit(2);
  }
}

const result = await handleEvent(config, event);
console.log(JSON.stringify(result, null, 2));
