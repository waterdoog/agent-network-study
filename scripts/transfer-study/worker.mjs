// One OS process per attempt keeps the original transport's environment-based
// ledger private to this attempt even when six episodes run concurrently.
import { readFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { HERE, checkAuthorization } from './manifest.mjs';
import { collectAttempt, withinExtension, readConfig } from './run.mjs';
import { hash } from './task.mjs';

async function main() {
  const args = {};
  for (let i = 2; i < process.argv.length; i += 2) {
    if (!['--run','--episode','--attempt','--authorization'].includes(process.argv[i])) throw new Error('Unknown worker argument');
    args[process.argv[i]] = process.argv[i+1];
  }
  const authorization = checkAuthorization(args['--authorization']);
  const out = withinExtension(resolve(args['--run']));
  const doc = JSON.parse(readFileSync(join(out, 'plan.json'), 'utf8'));
  const config = readConfig();
  if (JSON.stringify(doc.config) !== JSON.stringify(config) || doc.registration_commit !== authorization.registration_commit
    || doc.protocol_sha256 !== authorization.protocol_sha256
    || JSON.stringify(doc.source_manifest) !== JSON.stringify(authorization.source_manifest))
    throw new Error('Worker configuration/registration mismatch');
  const entry = doc.plan.find(e => e.id === args['--episode']);
  const attempt = Number(args['--attempt']);
  if (!entry || ![1,2].includes(attempt)) throw new Error('Unknown episode/attempt');
  const world = JSON.parse(readFileSync(join(out, entry.id, 'world.json'), 'utf8'));
  if (hash(world) !== doc.worlds[entry.seed].world_sha256) throw new Error('World hash mismatch');
  if (existsSync(join(out, entry.id, 'final.json'))) throw new Error('Episode already finalized');
  if (attempt === 2) {
    const first = JSON.parse(readFileSync(join(out, entry.id, 'attempt-1', 'summary.json'), 'utf8'));
    if (first.status !== 'technical-failure' || first.serving_exclusion) throw new Error('Only one genuine technical rerun is permitted');
  }
  const directory = join(out, entry.id, `attempt-${attempt}`);
  process.env.STUDY_SUBSCRIPTION_LEDGER = join(directory, 'transport-ledger.jsonl');
  const { subscriptionChat } = await import('../../src/lib/subscription.js');
  const usage = { calls: 0, promptTokens: 0, completionTokens: 0, retries: 0, failures: 0 };
  await collectAttempt({ entry, world, config, directory, attempt,
    chat: req => subscriptionChat(req, { model: config.model, usage }) });
}
main().catch(err => { process.stderr.write(`${err.message}\n`); process.exitCode = 1; });
