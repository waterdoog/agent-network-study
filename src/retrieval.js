#!/usr/bin/env node
// What a directory costs at a scale we cannot afford to run.
//
// Whether the agent that holds an answer survives into a capped search result
// is a retrieval question, not a language one: it needs no model call, so it
// can be computed at sizes the sweep will never reach. The LLM experiments then
// only have to establish the mapping from "were the holders retrievable" to
// "did the task succeed", which is measurable at a few hundred cards.
//
// Two ranking regimes bracket reality:
//
//   separable   a holder's tags match the query exactly and filler only
//               partially, so holders always outrank filler. This is what the
//               current scorer does, and it is why performance plateaued past
//               the cap instead of continuing to fall.
//   opaque      a card that merely sounds relevant is indistinguishable from one
//               that holds the answer, which is the honest case: nothing on a
//               card tells you whether its author actually knows.
//
// Reality sits between them. Reporting both is the point.
import { buildDirectory, searchCards } from './lib/directory.js';

const QUERIES = {
  conference: ['registration pricing group discount', 'venue capacity accessibility',
               'schedule tracks programme', 'travel visa letters'],
  'lab-dashboard': ['metric definitions thresholds', 'run operations experiments',
                    'measurement data datasets'],
};

/** Share of query-matching cards that actually hold something, measured. */
function measureDensity(scenario, dirSize, seeds = 5) {
  let holders = 0, matched = 0;
  const arm = { directoryScope: 'all', rosterSize: null };
  for (let seed = 1; seed <= seeds; seed++) {
    const dir = buildDirectory({ scenario, instance: 'A', E: 0.7, seed, dirSize });
    for (const q of QUERIES[scenario]) {
      const hits = searchCards(dir, arm, q, 1e9); // uncapped: the full match set
      matched += hits.length;
      holders += hits.filter((h) => h.id.startsWith('hold-')).length;
    }
  }
  return { density: holders / matched, matchedPerQuery: matched / (seeds * QUERIES[scenario].length) };
}

/**
 * P(a given holder survives a cap of k).
 *
 * separable: it always does, until holders alone exceed k.
 * opaque:    it is placed uniformly among the m cards the query matched, so it
 *            survives with probability k/m.
 */
const survives = (regime, k, m, holdersInMatch) =>
  regime === 'separable' ? (holdersInMatch <= k ? 1 : k / holdersInMatch)
                         : Math.min(1, k / m);

const scenario = process.argv[2] || 'conference';
const CAPS = [5, 10, 20, 40, 80];
const SIZES = [50, 100, 200, 400, 800, 1600, 3200, 12800, 51200, 204800, 1e6, 1e7];

// Calibrate the growth of the match set on sizes we can actually build, then
// extend it: both quantities are linear in directory size once the vocabulary
// is saturated, so the slope measured at 800 carries.
const cal = [200, 400, 800].map((n) => ({ n, ...measureDensity(scenario, n) }));
const slope = (cal[2].matchedPerQuery - cal[0].matchedPerQuery) / (cal[2].n - cal[0].n);
const intercept = cal[2].matchedPerQuery - slope * cal[2].n;
const HOLDERS_PER_QUERY = 2;

console.log(`# retrieval at scale — ${scenario}`);
console.log(`# match-set growth calibrated on 200/400/800: m(N) = ${slope.toFixed(4)}N + ${intercept.toFixed(1)}`);
cal.forEach((c) => console.log(`#   N=${c.n}: ${c.matchedPerQuery.toFixed(1)} matches per query, ${(100 * c.density).toFixed(1)}% of them hold anything`));
console.log();
console.log('P(a needed holder survives the cap)\n');
console.log(['N'.padStart(9), ...CAPS.map((k) => `cap=${k}`.padStart(9))].join(' ') + '   regime');
for (const regime of ['separable', 'opaque']) {
  for (const N of SIZES) {
    const m = Math.max(HOLDERS_PER_QUERY, slope * N + intercept);
    const row = CAPS.map((k) => survives(regime, k, m, HOLDERS_PER_QUERY).toFixed(3).padStart(9));
    console.log([String(N).padStart(9), ...row].join(' ') + `   ${regime}`);
  }
  console.log();
}
