import { readFileSync } from 'fs';
import { resolve } from 'path';

export function loadConfig() {
  try {
    const p = resolve(process.cwd(), 'craig.config.json');
    const raw = readFileSync(p, 'utf-8');
    return JSON.parse(raw);
  } catch (_) {
    return {};
  }
}
