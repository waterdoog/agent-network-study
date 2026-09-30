#!/usr/bin/env node
// Offline acceptance for the dispersion x interference cells. No model is
// called. Exit 1 on any failure, so it can gate a sweep.
//
// For all 27 cells and seeds 1..6, on instance A and (where the base has one)
// instance B:
//   (i)   the facts are the base's facts -- same ids, same text, same order --
//         and the assertions are the base's assertions, verbatim;
//   (ii)  the holders are 2 / the original set / at most 16 with no holder
//         over two facts, every holder has a role with tags, and holder ids are
//         safe card ids;
//   (iii) i=0 plants nothing, i=4 plants exactly the original four, i=8 those
//         plus four generated ones whose wrong number is not a number of the
//         fact they flip, with the true value gone from the text; every
//         distractor sits away from the true holder of the fact it flips;
//   (iv)  the same cell and seed always yields the same instance, and cells of
//         one base agree on facts, holders (per d) and originals (per d);
//   (v)   the directory at E=0 reaches every holder, is 100 cards with a
//         20-card roster, and a search for each original role's first tag
//         finds a holder card.
import { SCENARIOS, buildDirectory, searchCards } from '../src/lib/directory.js';
import { HOLDER_ROLE } from '../src/lib/roles.js';
import { KNOB_BASES, KNOB_DS, KNOB_IS } from '../src/scenarios/knobs.js';

const SEEDS = [1, 2, 3, 4, 5, 6];
const CELLS = Object.keys(KNOB_BASES).flatMap((base) => KNOB_DS.flatMap((d) => KNOB_IS.map((i) => ({ id: `${base}-D${d}-I${i}`, base, d, i }))));

let failures = 0;
let checks = 0;
function expect(cond, msg) {
  checks++;
  if (!cond) { failures++; console.log(`FAIL ${msg}`); }
}
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
// Number tokens the way countAbsorbed reads them: digit runs bounded by
// non-digits, with an optional decimal part.
const nums = (t) => [...String(t).matchAll(/(?<![\d.])(\d+(?:\.\d+)?)(?!\.?\d)/g)].map((m) => m[1]);

expect(CELLS.length === 27, `27 cells (got ${CELLS.length})`);
const perBase = {};   // base -> seed -> key -> cell id -> { facts, holders, originals }

for (const cell of CELLS) {
  const sc = SCENARIOS[cell.id];
  const baseSc = KNOB_BASES[cell.base];
  expect(sc && sc.id === cell.id, `${cell.id}: registered`);
  if (!sc) continue;
  expect(sc.generated === true && !sc.instances && typeof sc.makeInstance === 'function', `${cell.id}: generated, makeInstance, no static instances`);
  expect(sc.mode === undefined, `${cell.id}: no mode field (the harness must treat it as the facts family)`);
  expect(sc.base === cell.base && sc.d === cell.d && sc.i === cell.i, `${cell.id}: base/d/i fields`);
  expect(sc.domain === baseSc.domain && sc.fn === baseSc.fn && sc.spec === baseSc.spec, `${cell.id}: domain/fn/spec from the base`);
  expect(eq(sc.componentPlans, baseSc.componentPlans), `${cell.id}: componentPlans from the base`);
  expect(sc.id.length === `${cell.base}-D1-I0`.length, `${cell.id}: id length shared across the base`);

  for (const seed of SEEDS) {
    for (const key of Object.keys(baseSc.instances)) {
      const baseInst = baseSc.instances[key];
      const inst = sc.makeInstance(key, seed);
      const tag = `${cell.id} ${key} seed=${seed}`;
      const originalHolders = [...new Set(baseInst.facts.map((f) => f.holder))];

      // -- (i) facts and assertions --------------------------------------------
      expect(inst.brief === baseInst.brief, `${tag}: brief from the base`);
      expect(eq(inst.facts.map((f) => [f.id, f.text]), baseInst.facts.map((f) => [f.id, f.text])), `${tag}: facts (id, text) identical to the base, in order`);
      expect(eq(inst.assertions, baseInst.assertions), `${tag}: assertions identical to the base`);
      expect(inst.assertions !== baseInst.assertions, `${tag}: assertions are a copy, not the base's array`);
      expect(inst.rework === undefined, `${tag}: no rework`);

      // -- (ii) holders ---------------------------------------------------------------
      const holders = inst.meta.holders;
      const holderSet = new Set(inst.facts.map((f) => f.holder));
      expect(eq([...holderSet].sort(), holders.slice().sort()), `${tag}: meta.holders lists exactly the holders the facts use`);
      expect(eq(Object.keys(inst.holderRoles).sort(), holders.slice().sort()), `${tag}: holderRoles covers every holder and nothing else`);
      for (const h of holders) {
        expect(/^[a-z0-9-]+$/.test(h), `${tag}: holder id ${h} is a safe card id`);
        const role = inst.holderRoles[h];
        expect(role && typeof role.name === 'string' && role.name.length && Array.isArray(role.tags) && role.tags.length > 0, `${tag}: holder ${h} has a name and non-empty tags`);
      }
      const perHolder = (h) => inst.facts.filter((f) => f.holder === h);
      if (cell.d === 1) {
        expect(holders.length === 2, `${tag}: d=1 has two holders (got ${holders.length})`);
        const half = Math.ceil(originalHolders.length / 2);
        const groups = [originalHolders.slice(0, half), originalHolders.slice(half)];
        groups.forEach((g) => {
          const id = g.join('-');
          expect(holders.includes(id), `${tag}: merged holder ${id}`);
          const wantFacts = baseInst.facts.filter((f) => g.includes(f.holder)).map((f) => f.id);
          expect(eq(perHolder(id).map((f) => f.id), wantFacts), `${tag}: ${id} holds every fact of ${g.join(', ')}`);
          const role = inst.holderRoles[id] || {};
          expect(g.every((r) => role.name?.includes(HOLDER_ROLE[r].name)), `${tag}: ${id} named after its roles`);
          expect(eq(role.tags, [...new Set(g.flatMap((r) => HOLDER_ROLE[r].tags))]), `${tag}: ${id} tags are the union of its roles' tags`);
        });
      } else if (cell.d === 2) {
        expect(eq(holders.slice().sort(), originalHolders.slice().sort()), `${tag}: d=2 keeps the original holders`);
        expect(inst.facts.every((f, n) => f.holder === baseInst.facts[n].holder), `${tag}: d=2 keeps every fact's holder`);
        for (const h of holders) expect(eq(inst.holderRoles[h], HOLDER_ROLE[h]), `${tag}: ${h} role from the table`);
      } else {
        expect(holders.length <= 16, `${tag}: d=3 has at most 16 holders (got ${holders.length})`);
        expect(holders.every((h) => perHolder(h).length <= 2 && perHolder(h).length >= 1), `${tag}: d=3 no holder over two facts, none empty`);
        for (const r of originalHolders) {
          const mine = baseInst.facts.filter((f) => f.holder === r);
          const n = Math.ceil(mine.length / 2);
          for (let k = 1; k <= n; k++) {
            const id = `${r}-${k}`;
            expect(holders.includes(id), `${tag}: split holder ${id}`);
            expect(eq(perHolder(id).map((f) => f.id), mine.slice(2 * (k - 1), 2 * k).map((f) => f.id)), `${tag}: ${id} holds facts ${2 * k - 1}-${2 * k} of ${r} in original order`);
            const role = inst.holderRoles[id] || {};
            expect(role.name === `${HOLDER_ROLE[r].name} (${k})` && eq(role.tags, HOLDER_ROLE[r].tags), `${tag}: ${id} name/tags`);
          }
        }
        const expectCount = originalHolders.reduce((s, r) => s + Math.ceil(baseInst.facts.filter((f) => f.holder === r).length / 2), 0);
        expect(holders.length === expectCount, `${tag}: d=3 holder count ${expectCount} (got ${holders.length})`);
      }

      // -- (iii) distractors ------------------------------------------------------------
      const truthHolder = Object.fromEntries(inst.facts.map((f) => [f.id, f.holder]));
      expect(inst.distractors.length === cell.i && inst.meta.nDistractors === cell.i, `${tag}: ${cell.i} distractors (got ${inst.distractors.length})`);
      expect(new Set(inst.distractors.map((x) => x.id)).size === inst.distractors.length, `${tag}: distractor ids unique`);
      for (const x of inst.distractors) {
        expect(truthHolder[x.flips] !== undefined, `${tag}: ${x.id} flips a fact that exists`);
        expect(holderSet.has(x.holder), `${tag}: ${x.id} sits on a holder that exists (${x.holder})`);
        expect(x.holder !== truthHolder[x.flips], `${tag}: ${x.id} sits away from the true holder of ${x.flips}`);
        expect(typeof x.text === 'string' && x.text.length > 0, `${tag}: ${x.id} has text`);
      }
      const originals = inst.distractors.slice(0, Math.min(4, cell.i));
      if (cell.i >= 4) {
        expect(eq(originals.map((x) => [x.id, x.text, x.flips]), baseInst.distractors.map((x) => [x.id, x.text, x.flips])), `${tag}: the first four are the original four (id, text, flips)`);
        if (cell.d === 2) expect(eq(originals.map((x) => x.holder), baseInst.distractors.map((x) => x.holder)), `${tag}: d=2 keeps the originals' holders`);
      }
      const generated = inst.distractors.slice(4);
      expect(eq(inst.meta.generated, generated.map((x) => x.id)), `${tag}: meta.generated lists the generated ids`);
      if (cell.i === 8) {
        expect(generated.length === 4, `${tag}: four generated distractors`);
        const contradicted = new Set(baseInst.distractors.map((x) => x.flips));
        expect(new Set(generated.map((x) => x.flips)).size === 4, `${tag}: generated distractors flip four distinct facts`);
        for (const x of generated) {
          expect(!contradicted.has(x.flips), `${tag}: ${x.id} flips a fact the originals leave alone`);
          expect(x.id === `g_${x.flips}`, `${tag}: ${x.id} named after the fact it flips`);
          const truth = inst.facts.find((f) => f.id === x.flips);
          const trueNums = new Set(nums(truth.text));
          const wrong = nums(x.text).filter((v) => !trueNums.has(v));
          expect(wrong.length >= 1, `${tag}: ${x.id} carries a number the true fact does not ("${x.text}")`);
          // The replaced value is the true fact's number that the distractor
          // dropped; it must not survive anywhere in the distractor.
          const dropped = [...trueNums].filter((v) => !nums(x.text).includes(v));
          expect(dropped.length >= 1, `${tag}: ${x.id} drops a true value ("${x.text}" vs "${truth.text}")`);
          for (const v of dropped) expect(!new RegExp(`(?<![\\d.])${v.replace(/\./g, '\\.')}(?!\\.?\\d)`).test(x.text), `${tag}: ${x.id} still states the true value ${v}`);
          // The wrong value must not be a value any fact states, or the page
          // could carry it for a true reason.
          const allNums = new Set(inst.facts.flatMap((f) => nums(f.text)).map(Number));
          for (const v of wrong) expect(!allNums.has(Number(v)), `${tag}: ${x.id} wrong value ${v} is a number some fact states`);
          expect(Number(wrong[0]) > 0, `${tag}: ${x.id} wrong value positive`);
          // Same granularity as the original: integer for integer, two
          // decimals for a two-decimal original.
          const origTok = dropped[0];
          const origDec = origTok.includes('.') ? origTok.split('.')[1].length : 0;
          for (const v of wrong) expect((v.includes('.') ? v.split('.')[1].length : 0) === origDec, `${tag}: ${x.id} wrong value ${v} keeps the granularity of ${origTok}`);
          // A proportion stays a proportion, and a range end is never the
          // perturbed token: an impossible claim does not interfere.
          if (origDec && Number(origTok) < 1) for (const v of wrong) expect(Number(v) < 1, `${tag}: ${x.id} wrong proportion ${v} below one`);
          expect(!new RegExp(`${origTok}-\\d|\\d-${origTok}`).test(truth.text), `${tag}: ${x.id} does not perturb a range end of "${truth.text}"`);
          expect(/^(I recall |I think |As far as I remember )|( I believe\.| last I checked\.)$/.test(x.text), `${tag}: ${x.id} hedged like the originals ("${x.text}")`);
        }
      }

      // -- (iv) determinism -----------------------------------------------------------------
      expect(eq(sc.makeInstance(key, seed), inst), `${tag}: makeInstance is deterministic`);
      expect(inst.meta.base === cell.base && inst.meta.d === cell.d && inst.meta.i === cell.i && inst.meta.seed === seed, `${tag}: meta base/d/i/seed`);
      ((perBase[cell.base] ??= {})[seed] ??= {})[key] ??= {};
      perBase[cell.base][seed][key][cell.id] = {
        facts: inst.facts, holders, roles: inst.holderRoles, originals: inst.distractors.slice(0, Math.min(4, cell.i)),
      };

      // -- (v) directory -----------------------------------------------------------------------
      if (key !== 'A') continue;
      const dir = buildDirectory({ scenario: cell.id, instance: 'A', E: 0, seed, inst });
      expect(dir.outside.size === 0, `${tag}: no holder outside at E=0`);
      expect(holders.every((h) => dir.roster.has(`hold-${h}`)), `${tag}: every holder card in the roster`);
      expect(dir.roster.size === 20 && dir.cards.length === 100, `${tag}: roster of 20, 100 cards (got ${dir.roster.size}, ${dir.cards.length})`);
      for (const c of dir.cards.filter((x) => x.kind === 'payload')) {
        expect(c.knowledge.length === perHolder(c.holder).length && c.name === inst.holderRoles[c.holder].name, `${tag}: card ${c.id} carries its facts under its role name`);
        const planted = inst.distractors.filter((x) => x.holder === c.holder).map((x) => x.text);
        expect(eq(c.planted, planted), `${tag}: card ${c.id} carries its ${planted.length} planted distractors`);
      }
      for (const r of originalHolders) {
        const hits = searchCards(dir, { directoryScope: 'all' }, HOLDER_ROLE[r].tags[0]);
        expect(hits.some((h) => h.id.startsWith('hold-')), `${tag}: search "${HOLDER_ROLE[r].tags[0]}" finds a holder card`);
      }
    }
  }
}

// -- (iv) across cells of one base and seed --------------------------------------------
for (const [base, bySeed] of Object.entries(perBase)) {
  for (const [seed, byKey] of Object.entries(bySeed)) {
    for (const [key, cells] of Object.entries(byKey)) {
      const ids = Object.keys(cells);
      const ref = cells[ids[0]];
      for (const id of ids.slice(1)) {
        expect(eq(cells[id].facts.map((f) => [f.id, f.text]), ref.facts.map((f) => [f.id, f.text])), `${base} ${key} seed=${seed}: facts identical across cells (${id})`);
      }
      for (const d of KNOB_DS) {
        const same = ids.filter((id) => id.includes(`-D${d}-`));
        const r = cells[same[0]];
        for (const id of same.slice(1)) {
          expect(eq(cells[id].facts, r.facts) && eq(cells[id].holders, r.holders) && eq(cells[id].roles, r.roles), `${base} ${key} seed=${seed} d=${d}: holders and fact placement identical across i (${id})`);
        }
        // i=4 and i=8 plant the original four in the same places, so the i
        // contrast is only the four generated distractors.
        const i4 = cells[`${base}-D${d}-I4`], i8 = cells[`${base}-D${d}-I8`];
        if (i4 && i8) expect(eq(i4.originals, i8.originals), `${base} ${key} seed=${seed} d=${d}: originals placed identically at i=4 and i=8`);
      }
    }
  }
}

console.log(`${checks} checks, ${failures} failures`);
process.exit(failures ? 1 : 0);
