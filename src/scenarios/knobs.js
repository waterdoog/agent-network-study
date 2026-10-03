// The dispersion x interference family. The three hidden-profile scenarios
// (conference, lab-dashboard, trip-planner) are kept whole -- same facts, same
// assertions, same responder prompt, same scoring -- and two knobs are turned
// on top of them, at E = 0 so every holder is reachable and the bounded arms
// are not handicapped by reach:
//
//   d  dispersion: how many holders the same 14 facts are spread across
//      1  the original holders merged into two
//      2  the original allocation
//      3  every original holder split so none carries more than two facts
//   i  interference: how many planted distractors
//      0  none
//      4  the original four
//      8  the original four plus four generated ones
//
// Facts and assertions never change across the nine cells of a base: only who
// holds what, and how much of what is said is false. That is what lets the
// analysis pair cells by seed.
import conference from './conference.js';
import lab from './lab-dashboard.js';
import trip from './trip-planner.js';
import { HOLDER_ROLE } from '../lib/roles.js';

const BASES = { conf: conference, lab, trip };
const DS = [1, 2, 3];
const IS = [0, 4, 8];

// The holder count at d=3 has to leave room for the four builders on the
// 20-card roster; every base is well under this, but the generator refuses
// rather than silently producing a roster no bounded arm could complete.
const MAX_HOLDERS = 16;

// ---- deterministic randomness -------------------------------------------
// Same LCG as directory.js so a seed reproduces a cell exactly. The stream is
// seeded from a hash of the cell coordinates, so two cells never share a draw
// by accident and the same cell always draws the same way.
function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}
function shuffle(arr, rand) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
const pick = (rand, arr) => arr[Math.floor(rand() * arr.length)];
/** FNV-1a over the cell coordinates: a 32-bit seed for the LCG. */
export function hashSeed(...parts) {
  let h = 0x811c9dc5;
  for (const ch of parts.join('|')) { h ^= ch.charCodeAt(0); h = Math.imul(h, 0x01000193) >>> 0; }
  return h;
}

// ---- helpers ----------------------------------------------------------------
/** Original holder ids in order of first mention, which is the scenario's own order. */
const originalHolders = (inst) => [...new Set(inst.facts.map((f) => f.holder))];
const uniq = (arr) => [...new Set(arr)];
/** "A and B" for two, "A, B and C" for more: the merged holder's name. */
const joinNames = (names) => (names.length <= 1 ? names[0]
  : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`);

// Number tokens as the scorer and countAbsorbed see them: digit runs with an
// optional decimal part, bounded by non-digits. Two kinds are left out of the
// perturbable set: a four-digit year ("the 2027 edition" made wrong is not a
// claim anyone would repeat, and the year is not scored) and either end of a
// range ("12-14 April" with one end moved is an impossible range, not a wrong
// date). A distractor has to be plausible to interfere.
const NUM_RE = /(?<![\d.])(\d+(?:\.\d+)?)(?!\.?\d)/g;
const numbersIn = (text) => [...text.matchAll(NUM_RE)].map((m) => m[1]);
const isYear = (tok) => /^(19|20)\d\d$/.test(tok);
const isRangeEnd = (text, tok) => new RegExp(`(?<![\\d.])${tok}-\\d|\\d-${tok}(?!\\.?\\d)`).test(text);
const perturbable = (text) => numbersIn(text).filter((t) => !isYear(t) && !isRangeEnd(text, t));

// ---- dispersion ------------------------------------------------------------------
/**
 * Where each fact lives under dispersion d, and who the holders are.
 * Returns { holderOf: {factId: holderId}, holderRoles: {holderId: {name, tags}},
 *           holders: [holderId], roleOf: {holderId: [originalRole...]} }.
 *
 * The mapping is structural -- halves in original order, pairs in original
 * order -- so it is the same in every seed; `seed` is accepted so the three
 * helpers share one signature, and so a later variant can randomise the
 * split without changing callers.
 */
export function dispersionMap(baseInst, d, seed) {
  void seed;
  if (!DS.includes(d)) throw new Error(`knobs: d must be 1, 2 or 3, got ${d}`);
  const roles = originalHolders(baseInst);
  for (const r of roles) if (!HOLDER_ROLE[r]) throw new Error(`knobs: no role entry for holder ${r}`);
  const holderOf = {};
  const holderRoles = {};
  const roleOf = {};

  if (d === 2) {
    for (const r of roles) { holderRoles[r] = { name: HOLDER_ROLE[r].name, tags: HOLDER_ROLE[r].tags.slice() }; roleOf[r] = [r]; }
    for (const f of baseInst.facts) holderOf[f.id] = f.holder;
  } else if (d === 1) {
    // Two holders: the original list cut in half in its original order, each
    // half keeping every fact of the roles it absorbs.
    const half = Math.ceil(roles.length / 2);
    for (const group of [roles.slice(0, half), roles.slice(half)]) {
      const id = group.join('-');
      holderRoles[id] = {
        name: joinNames(group.map((r) => HOLDER_ROLE[r].name)),
        tags: uniq(group.flatMap((r) => HOLDER_ROLE[r].tags)),
      };
      roleOf[id] = group;
      for (const f of baseInst.facts) if (group.includes(f.holder)) holderOf[f.id] = id;
    }
  } else {
    // A role with k facts becomes ceil(k/2) holders, facts assigned two per
    // holder in original order, so no holder carries more than two facts.
    for (const r of roles) {
      const mine = baseInst.facts.filter((f) => f.holder === r);
      mine.forEach((f, n) => {
        const id = `${r}-${Math.floor(n / 2) + 1}`;
        if (!holderRoles[id]) {
          holderRoles[id] = { name: `${HOLDER_ROLE[r].name} (${Math.floor(n / 2) + 1})`, tags: HOLDER_ROLE[r].tags.slice() };
          roleOf[id] = [r];
        }
        holderOf[f.id] = id;
      });
    }
  }
  const holders = Object.keys(holderRoles);
  if (holders.length > MAX_HOLDERS) throw new Error(`knobs: ${holders.length} holders at d=${d} exceeds ${MAX_HOLDERS}`);
  for (const h of holders) if (!/^[a-z0-9-]+$/.test(h)) throw new Error(`knobs: holder id ${h} is not a safe card id`);
  return { holderOf, holderRoles, holders, roleOf };
}

// ---- interference ------------------------------------------------------------
const FACTORS = [0.5, 0.75, 1.25, 1.5, 2];
// The originals hedge ("I recall ...", "... I believe"); the generated ones use
// the same register so a distractor cannot be told from a genuine claim by its
// phrasing alone.
const PHRASINGS = [
  (s) => `I recall ${lowerFirst(s)}`,
  (s) => `${s.replace(/\.$/, '')} I believe.`,
  (s) => `I think ${lowerFirst(s)}`,
  (s) => `${s.replace(/\.$/, '')}, last I checked.`,
  (s) => `As far as I remember ${lowerFirst(s)}`,
];
/** Lower-case a sentence's first letter unless it opens an acronym or a code (RS-114). */
function lowerFirst(s) {
  return /^[A-Z][a-z]/.test(s) ? s[0].toLowerCase() + s.slice(1) : s;
}

/**
 * A wrong value for `tok` by a seed-chosen factor, at the token's own
 * granularity: integers stay integers, decimals keep their decimal places. The
 * factors are tried in a seed-rotated order until one lands on a value that is
 * neither the original nor any number any fact states, so the wrong value is
 * unambiguously wrong. A decimal below one is a proportion (recall, drift):
 * its wrong value stays below one, because "recall is 1.58" is impossible
 * rather than wrong and would be dismissed instead of believed.
 */
function perturb(tok, taken, rand) {
  const decimals = tok.includes('.') ? tok.split('.')[1].length : 0;
  const orig = Number(tok);
  const proportion = decimals > 0 && orig < 1;
  const start = Math.floor(rand() * FACTORS.length);
  for (let k = 0; k < FACTORS.length; k++) {
    const factor = FACTORS[(start + k) % FACTORS.length];
    const v = decimals ? (orig * factor).toFixed(decimals) : String(Math.round(orig * factor));
    if (Number(v) <= 0 || Number(v) === orig || taken.has(Number(v))) continue;
    if (proportion && Number(v) >= 1) continue;
    return v;
  }
  return null;
}

/**
 * Distractors for interference level i, placed on the holders of dispersion
 * `holders` ({ holderOf, holders }). The original four keep their id, text and
 * flips and move with their holder; the four generated ones contradict facts
 * the originals leave alone. Every distractor sits on a holder other than the
 * true holder of the fact it flips, which is what makes it a distractor rather
 * than a correction.
 */
export function generateDistractors(baseInst, i, holders, seed) {
  if (!IS.includes(i)) throw new Error(`knobs: i must be 0, 4 or 8, got ${i}`);
  const { holderOf, holders: ids, roleOf } = holders;
  if (i === 0) return { distractors: [], generated: [] };

  // The cell coordinates the streams are hashed from. makeInstance labels the
  // map with base and d; a caller passing a bare dispersionMap result gets the
  // brief and the holder list, which identify the same thing.
  const cell = [holders.base ?? baseInst.brief, holders.d ?? ids.join(','), baseInst.brief];
  // The originals are placed by a stream that does not see i, so i=4 and i=8
  // plant the same four in the same places and the i contrast is only the
  // four generated ones.
  const randOrig = rng(hashSeed(...cell, 'orig', seed));
  const distractors = baseInst.distractors.map((x) => {
    const truth = holderOf[x.flips];
    // Under d=1 the original holder is inside a merged one; under d=3 it is one
    // of several split ones. Either way the true holder is excluded.
    const candidates = ids.filter((h) => h !== truth && (roleOf[h] || []).includes(x.holder));
    const holder = candidates.length ? pick(randOrig, candidates) : pick(randOrig, ids.filter((h) => h !== truth));
    return { id: x.id, holder, text: x.text, flips: x.flips };
  });
  if (i === 4) return { distractors, generated: [] };

  const rand = rng(hashSeed(...cell, i, seed));
  const contradicted = new Set(baseInst.distractors.map((x) => x.flips));
  const stated = new Set(baseInst.facts.flatMap((f) => numbersIn(f.text)).map(Number));
  const candidates = baseInst.facts.filter((f) => !contradicted.has(f.id) && perturbable(f.text).length);
  const generated = [];
  for (const f of shuffle(candidates, rand)) {
    if (generated.length === 4) break;
    const tok = perturbable(f.text)[0];
    const wrong = perturb(tok, stated, rand);
    if (wrong === null) continue;
    // Every occurrence of the value goes, so a cutoff sentence stays coherent
    // ("amber from 300 up to 400" rather than "below 300, amber from 200") and
    // the true value does not survive inside the distractor.
    const esc = tok.replace(/\./g, '\\.');
    const sentence = f.text.replace(new RegExp(`(?<![\\d.])${esc}(?!\\.?\\d)`, 'g'), wrong);
    const text = pick(rand, PHRASINGS)(sentence);
    const holder = pick(rand, ids.filter((h) => h !== holderOf[f.id]));
    // Two generated distractors may land on the same wrong value (several trip
    // facts say "3", and "5" is wrong for each of them): they contradict
    // different facts, and countAbsorbed judges each against its own truth.
    generated.push({ id: `g_${f.id}`, holder, text, flips: f.id, wrong: Number(wrong) });
  }
  if (generated.length < 4) throw new Error(`knobs: only ${generated.length} generated distractors possible for ${baseInst.brief}`);
  return {
    distractors: distractors.concat(generated.map(({ id, holder, text, flips }) => ({ id, holder, text, flips }))),
    generated: generated.map((x) => x.id),
  };
}

// ---- the instance ---------------------------------------------------------------
/**
 * Instance for one episode of cell (base, d, i). Key 'A' is the base's A
 * instance; any other key uses the base instance of that key when it exists
 * (B, for the warm beats) and A otherwise. No rework: this family asks a
 * cold-build question, and timeline.js drops rework beats it cannot apply.
 */
export function makeInstance(base, d, i, instanceKey, seed) {
  const sc = BASES[base];
  if (!sc) throw new Error(`knobs: base must be one of ${Object.keys(BASES).join(', ')}, got ${base}`);
  const baseInst = sc.instances[instanceKey] || sc.instances.A;
  const map = { ...dispersionMap(baseInst, d, seed), base, d };
  const { distractors, generated } = generateDistractors(baseInst, i, map, seed);
  return {
    brief: baseInst.brief,
    // Same 14 facts, same order, same text: only the holder moves.
    facts: baseInst.facts.map((f) => ({ ...f, holder: map.holderOf[f.id] })),
    distractors,
    assertions: baseInst.assertions.map((a) => ({ ...a })),
    holderRoles: map.holderRoles,
    meta: { base, d, i, seed, holders: map.holders.slice(), nDistractors: distractors.length, generated },
  };
}

/** The scenario object for one (base, d, i) cell. */
export default function makeKnobs({ base, d, i }) {
  const sc = BASES[base];
  if (!sc) throw new Error(`knobs: base must be one of ${Object.keys(BASES).join(', ')}, got ${base}`);
  if (!DS.includes(d)) throw new Error(`knobs: d must be 1, 2 or 3, got ${d}`);
  if (!IS.includes(i)) throw new Error(`knobs: i must be 0, 4 or 8, got ${i}`);
  return {
    // Ids of one base are all the same length: buildDirectory mixes the id
    // length into its seed, so the nine cells of a base share one directory.
    id: `${base}-D${d}-I${i}`,
    base,
    domain: sc.domain,
    fn: sc.fn,
    fnDoc: sc.fnDoc,
    spec: sc.spec,
    ...(sc.componentPlans ? { componentPlans: sc.componentPlans } : {}),
    // No `mode`: the harness treats the cell exactly as the old facts family.
    // Generated per seed rather than shipped as a static instances map; run.js
    // leaves generated scenarios out of its default --scenarios list.
    generated: true,
    d, i,
    makeInstance: (instanceKey, seed) => makeInstance(base, d, i, instanceKey, seed),
  };
}

export { BASES as KNOB_BASES, DS as KNOB_DS, IS as KNOB_IS };
