#!/usr/bin/env node
// Sweep driver. Resumable: an episode with a summary.json on disk is skipped,
// so a killed run is restarted by re-issuing the same command.
import { mkdirSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ARMS } from './lib/arms.js';
import { SCENARIOS } from './lib/directory.js';
import { EpisodeLog, setLogLevel, note, setProgress } from './lib/log.js';
import { runEpisode } from './lib/timeline.js';
import { usage, estimateCost, MODEL } from './lib/openrouter.js';

const argv = process.argv.slice(2);
const flag = (n, d) => { const i = argv.indexOf(`--${n}`); return i >= 0 ? argv[i + 1] : d; };
const has = (n) => argv.includes(`--${n}`);

const RUN_ID = flag('run', new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19));
const ROOT = join(process.cwd(), 'runs', RUN_ID);
const ARM_LIST = (flag('arms', 'public,private,hybrid')).split(',');
const SC_LIST = (flag('scenarios', Object.keys(SCENARIOS).join(','))).split(',');
const E_LIST = (flag('E', '0.3,0.7')).split(',').map(Number);
const SEEDS = Number(flag('seeds', 3));
const PAR = Number(flag('par', 6));
const PROFILE = flag('profile', 'bare');
const SEED_PROFILES_ARG = String(flag('seed-profile', 'control')).split(',');
const K_LIST = String(flag('k', '1')).split(',').map(Number);
// Turns a first contact costs on an edge that does not already exist. A roster
// edge is formed before the episode begins; an open-directory edge is not.
const EDGE_COST_LIST = String(flag('edge-cost', '0')).split(',').map(Number);
// >1 replaces the rework beats with that many warm builds, for the slope.
const REPEATS = Number(flag('repeats', 1));
// Hops a bounded network may use to reach past its roster. 0 makes the roster a
// wall; 1 lets a contact forward once, which is how information actually
// reaches a closed network.
const RELAY_LIST = String(flag('relay', '0')).split(',').map(Number);
// Cards on the board. The bounded roster stays at 20 whatever this is, so the
// sweep asks what an open directory costs as it grows: more to read per search,
// and a smaller share of what comes back worth reading.
const DIR_LIST = String(flag('dir-size', '100')).split(',').map(Number);   // components the deliverable is split into
setLogLevel(has('verbose') ? 'verbose' : flag('log', 'normal'));

const smoke = has('smoke');

const episodes = [];
for (const sc of smoke ? [SC_LIST[0]] : SC_LIST)
  for (const armId of smoke ? ['public', 'private'] : ARM_LIST)
    for (const E of smoke ? [E_LIST[0]] : E_LIST)
      for (const k of smoke ? [K_LIST[0]] : K_LIST)
        for (const sp of smoke ? [SEED_PROFILES_ARG[0]] : SEED_PROFILES_ARG)
          for (const ec of smoke ? [EDGE_COST_LIST[0]] : EDGE_COST_LIST)
            for (const rd of smoke ? [RELAY_LIST[0]] : RELAY_LIST)
              for (const ds of smoke ? [DIR_LIST[0]] : DIR_LIST)
                for (let seed = 1; seed <= (smoke ? 1 : SEEDS); seed++)
                  episodes.push({ armId, scenarioId: sc, E, seed, k, seedProfile: sp, edgeCost: ec, relayDepth: rd, dirSize: ds });

mkdirSync(ROOT, { recursive: true });
note(`run ${RUN_ID}  model=${MODEL}  episodes=${episodes.length}  par=${PAR}`);
note(`arms=${ARM_LIST.join('/')} scenarios=${SC_LIST.join('/')} E=${E_LIST.join('/')} seeds=${SEEDS} profile=${PROFILE} seed-profiles=${SEED_PROFILES_ARG.join('/')} edge-cost=${EDGE_COST_LIST.join('/')} relay=${RELAY_LIST.join('/')} dir=${DIR_LIST.join('/')} repeats=${REPEATS}`);
note('-'.repeat(96));

const results = [];
let done = 0;
setProgress(0, episodes.length);
const started = Date.now();

async function worker(queue) {
  while (queue.length) {
    const spec = queue.shift();
    const spTag = spec.seedProfile && spec.seedProfile !== 'control' ? `_${spec.seedProfile}` : '';
    const id = `${spec.armId}_${spec.scenarioId}_E${spec.E}_k${spec.k}${spTag}_s${spec.seed}` + (spec.edgeCost ? `_ec${spec.edgeCost}` : '') + (REPEATS > 1 ? `_r${REPEATS}` : '') + (spec.relayDepth ? `_rl${spec.relayDepth}` : '') + (spec.dirSize !== 100 ? `_n${spec.dirSize}` : '');
    const outDir = join(ROOT, id);
    const summaryPath = join(outDir, 'summary.json');
    if (existsSync(summaryPath)) {
      results.push(JSON.parse(readFileSync(summaryPath, 'utf8')));
      note(`[${id}] resumed from disk`);
      done++;
    setProgress(done, episodes.length);
      continue;
    }
    mkdirSync(outDir, { recursive: true });
    const meta = { id, arm: spec.armId, scenario: spec.scenarioId, E: spec.E, seed: spec.seed, model: MODEL, profile: PROFILE, k: spec.k, seedProfile: spec.seedProfile, edgeCost: spec.edgeCost, repeats: REPEATS, relayDepth: spec.relayDepth, dirSize: spec.dirSize };
    const log = new EpisodeLog(join(outDir, 'events.jsonl'), meta);
    try {
      const summary = await runEpisode({
        id, arm: ARMS[spec.armId], scenarioId: spec.scenarioId, E: spec.E, seed: spec.seed, profile: PROFILE, k: spec.k, seedProfile: spec.seedProfile,
        edgeCost: spec.edgeCost, repeats: REPEATS, relayDepth: spec.relayDepth, dirSize: spec.dirSize,
        outDir, log, meta,
      });
      writeFileSync(summaryPath, JSON.stringify(summary, null, 2));
      results.push(summary);
    } catch (err) {
      log.fail('ep.crash', err, {});
      writeFileSync(join(outDir, 'CRASHED'), String(err.stack || err));
    }
    done++;
    if (done % 3 === 0) {
      const el = (Date.now() - started) / 1000;
      note(`   ... ${done}/${episodes.length} episodes  ${Math.round(el)}s  $${estimateCost().toFixed(3)}  calls=${usage.calls} retries=${usage.retries} fails=${usage.failures}`);
    }
  }
}

const queue = episodes.slice();
await Promise.all(Array.from({ length: Math.min(PAR, queue.length) }, () => worker(queue)));

writeFileSync(join(ROOT, 'all.json'), JSON.stringify(results, null, 2));
writeFileSync(join(ROOT, 'usage.json'), JSON.stringify({ ...usage, costUSD: estimateCost(), model: MODEL, elapsedSec: (Date.now() - started) / 1000 }, null, 2));
note('-'.repeat(96));
note(`done: ${results.length}/${episodes.length} episodes in ${Math.round((Date.now() - started) / 60000)} min, $${estimateCost().toFixed(3)}`);
note(`results: ${ROOT}`);
