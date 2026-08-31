// The answer keys are the ground truth, so they get their own reference
// implementation and a check. A wrong key is invisible at runtime and would
// invalidate every episode; this refuses to let one ship.
import conference from '../src/scenarios/conference.js';
import lab from '../src/scenarios/lab-dashboard.js';
import trip from '../src/scenarios/trip-planner.js';

const num = (facts, id, re = /(\d+(?:\.\d+)?)/) => {
  const f = facts.find((x) => x.id === id);
  if (!f) throw new Error(`missing fact ${id}`);
  const m = f.text.match(re);
  if (!m) throw new Error(`no number in ${id}: ${f.text}`);
  return Number(m[1]);
};
const r2 = (x) => Math.round(x * 100) / 100;

const REF = {
  conference: (facts) => {
    const early = num(facts, 'fee_early'), std = num(facts, 'fee_std'), stu = num(facts, 'fee_stu');
    const ws = num(facts, 'fee_ws'), gmin = num(facts, 'grp_min'), gpct = num(facts, 'grp_pct');
    return ({ ticket, workshops, groupSize }) => {
      const base = { early, standard: std, student: stu }[ticket];
      let t = (base + workshops * ws) * groupSize;
      if (groupSize >= gmin) t *= 1 - gpct / 100;
      return r2(t);
    };
  },
  'lab-dashboard': (facts) => {
    const cuts = {};
    for (const m of ['lat', 'rec', 'dri']) {
      const t = facts.find((f) => f.id === `${m}_cuts`).text;
      const ns = [...t.matchAll(/(\d+(?:\.\d+)?)/g)].map((x) => Number(x[1]));
      const higher = /higher is now better|higher is better/.test(facts.find((f) => f.id === `${m}_dir`).text);
      cuts[m] = { a: ns[0], b: ns[1], c: ns[2], higher };
    }
    const key = { latency: 'lat', recall: 'rec', drift: 'dri' };
    return (metricId, value) => {
      const k = cuts[key[metricId]];
      // green/amber/red thresholds are written in the fact in green,amber-lo,red order
      if (k.higher) return value >= k.a ? 'green' : value >= k.b ? 'amber' : 'red';
      return value < k.a ? 'green' : value < k.c ? 'amber' : 'red';
    };
  },
  'trip-planner': (facts) => {
    const pass = num(facts, 'transit'), ma = num(facts, 'museum_a');
    const hasMuseum = !/closed all month|no museum entry/.test(facts.find((f) => f.id === 'hours').text);
    const mc = hasMuseum ? num(facts, 'museum_c') : 0;
    const ft = facts.find((f) => f.id === 'family').text;
    const kidsMin = Number(ft.match(/(\d+) or more children/)[1]);
    const pct = Number(ft.match(/(\d+) percent/)[1]);
    return ({ adults, children, days }) => {
      let t = days * pass * (adults + children) + (hasMuseum ? adults * ma + children * mc : 0);
      if (adults === 2 && children >= kidsMin) t *= 1 - pct / 100;
      return r2(t);
    };
  },
};

function applyRework(facts, rw) {
  const out = facts.map((f) => (rw.factOverrides?.[f.id] ? { ...f, ...rw.factOverrides[f.id] } : f));
  return out;
}
function effective(assertions, rw) {
  const over = rw?.assertionOverrides || {};
  const base = assertions.map((a) => (over[a.id] ? { ...a, ...over[a.id] } : a));
  return base.concat(rw?.addedAssertions || []);
}

let bad = 0, checked = 0;
for (const sc of [conference, lab, trip]) {
  for (const [key, inst] of Object.entries(sc.instances)) {
    for (const [phase, facts, asserts] of [
      ['build', inst.facts, inst.assertions],
      ['rework', applyRework(inst.facts, inst.rework), effective(inst.assertions, inst.rework)],
    ]) {
      let fn;
      try { fn = REF[sc.id](facts); } catch (e) { console.log(`  REF FAIL ${sc.id}/${key}/${phase}: ${e.message}`); bad++; continue; }
      for (const a of asserts.filter((x) => x.kind === 'calc')) {
        checked++;
        let got;
        try { got = fn(...a.args); } catch (e) { got = `THREW ${e.message}`; }
        const ok = typeof a.want === 'number' ? Math.abs(got - a.want) < 0.005 : got === a.want;
        if (!ok) { bad++; console.log(`  MISMATCH ${sc.id}/${key}/${phase} ${a.id}: key=${a.want} ref=${got}`); }
      }
    }
  }
}
console.log(`\nchecked ${checked} calc assertions, ${bad} mismatches`);
process.exit(bad ? 1 : 0);
