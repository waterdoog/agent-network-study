import { readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve } from 'node:path';
import { createHash } from 'node:crypto';

export const HERE = dirname(fileURLToPath(import.meta.url));
const SOURCES = ['control.py', 'config.json', 'task.mjs', 'engine.mjs', 'run.mjs', 'worker.mjs', 'score.mjs', 'manifest.mjs', '../../src/lib/subscription.js'];
export const digest = bytes => createHash('sha256').update(bytes).digest('hex');
export function sourceManifest() {
  return { schema: 1, files: Object.fromEntries(SOURCES.map(name => [name, digest(readFileSync(resolve(HERE, name)))])) };
}
export function checkAuthorization(path) {
  if (!path) throw new Error('Explicit authorization JSON is required; offline build/testing does not authorize model calls');
  const a = JSON.parse(readFileSync(path, 'utf8'));
  if (a.authorized !== true || !/^[a-f0-9]{40}$/.test(a.registration_commit || ''))
    throw new Error('Authorization must record affirmative permission and a full registration commit');
  if (digest(readFileSync(a.protocol_file)) !== a.protocol_sha256) throw new Error('Protocol differs from authorized protocol bytes');
  if (JSON.stringify(a.source_manifest) !== JSON.stringify(sourceManifest())) throw new Error('Source/config differs from frozen source manifest');
  return a;
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href)
  process.stdout.write(JSON.stringify(sourceManifest(), null, 2) + '\n');
