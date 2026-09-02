// The 100-card directory. Only the payload cards carry knowledge; the near-miss
// cards exist so that search is a skill rather than a lookup, and they are what
// makes search_precision a number worth reporting.
import conference from '../scenarios/conference.js';
import lab from '../scenarios/lab-dashboard.js';
import trip from '../scenarios/trip-planner.js';

export const SCENARIOS = { conference, 'lab-dashboard': lab, 'trip-planner': trip };

// Role vocabulary. Near-miss and noise cards draw from the same terms on
// purpose: a directory whose distractors are obviously irrelevant tests nothing.
const HOLDER_ROLE = {
  venue:   { name: 'Venue Operations',      tags: ['venue', 'capacity', 'facilities', 'events'] },
  program: { name: 'Programme Committee',   tags: ['programme', 'tracks', 'schedule', 'events'] },
  finance: { name: 'Registration Finance',  tags: ['pricing', 'fees', 'finance', 'billing'] },
  sales:   { name: 'Group Sales',           tags: ['pricing', 'discounts', 'groups', 'sales'] },
  access:  { name: 'Accessibility Lead',    tags: ['accessibility', 'captioning', 'inclusion'] },
  visa:    { name: 'Travel and Visa Desk',  tags: ['visa', 'travel', 'letters', 'logistics'] },
  ops:     { name: 'Run Operations',        tags: ['runs', 'operations', 'experiments'] },
  data:    { name: 'Measurement Data',      tags: ['data', 'measurements', 'datasets'] },
  metrics: { name: 'Metric Definitions',    tags: ['metrics', 'definitions', 'evaluation'] },
  thresh:  { name: 'Threshold Policy',      tags: ['thresholds', 'cutoffs', 'policy', 'metrics'] },
  destin:  { name: 'Destination Research',  tags: ['destination', 'itinerary', 'travel'] },
  transit: { name: 'Transit Pricing',       tags: ['transit', 'pricing', 'passes', 'travel'] },
  tickets: { name: 'Ticketing and Rates',   tags: ['tickets', 'pricing', 'discounts', 'family'] },
  hours:   { name: 'Opening Hours Desk',    tags: ['hours', 'closures', 'seasonal', 'venues'] },
};

const BUILDERS = [
  { id: 'build-html',  name: 'HTML Structure Builder', tags: ['html', 'markup', 'structure', 'frontend'] },
  { id: 'build-ui',    name: 'Layout and CSS',         tags: ['css', 'layout', 'frontend', 'design'] },
  { id: 'build-logic', name: 'Client-side Logic',      tags: ['javascript', 'logic', 'calculator', 'frontend'] },
  { id: 'build-copy',  name: 'Editorial Copy',         tags: ['copy', 'editorial', 'content'] },
];

const NEAR_MISS = [
  ['near-pricing',  'Pricing Analytics (historic)',  ['pricing', 'analytics', 'finance']],
  ['near-venue',    'Venue Photography',             ['venue', 'photography', 'events']],
  ['near-metrics',  'Metric Dashboards (legacy)',    ['metrics', 'dashboards', 'evaluation']],
  ['near-travel',   'Travel Expense Claims',         ['travel', 'expenses', 'finance']],
  ['near-html',     'HTML Email Templates',          ['html', 'email', 'markup']],
  ['near-thresh',   'Alert Threshold Archive',       ['thresholds', 'alerts', 'policy']],
  ['near-tickets',  'Ticket Refund Handling',        ['tickets', 'refunds', 'support']],
  ['near-schedule', 'Room Scheduling Tool',          ['schedule', 'rooms', 'facilities']],
];

const NOISE_TAGS = ['procurement', 'legal', 'payroll', 'security', 'localization', 'qa', 'support',
  'analytics', 'research', 'design', 'infrastructure', 'networking', 'archive', 'training',
  'partnerships', 'community', 'editorial', 'compliance', 'logistics', 'sourcing'];

/** Deterministic per-seed shuffle so a run can be reproduced exactly. */
function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}
function shuffle(arr, rand) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

/**
 * Build the directory for one episode.
 * @param {{scenario:string, instance:string, E:number, seed:number}} opts
 */
export function buildDirectory({ scenario, instance, E, seed, profile = 'bare', dirSize = 100 }) {
  const sc = SCENARIOS[scenario];
  const inst = sc.instances[instance];
  const rand = rng(seed * 7919 + scenario.length * 131 + instance.charCodeAt(0));
  const cards = [];
  const vetted = profile === 'vetted' || profile === 'realistic';
  const relational = profile === 'relational' || profile === 'realistic';

  const holders = [...new Set(inst.facts.map((f) => f.holder))];

  // The roster split is computed BEFORE the cards, because under `vetted` the
  // distractors have to know which holders end up outside. In the `bare`
  // profile distractors sit where the scenario put them, which spreads them
  // evenly across the boundary — a roster no more reliable than the open world,
  // which is not why anyone keeps a roster.
  const holderIds = holders.map((h) => `hold-${h}`);
  const orderH = shuffle(holderIds, rand);
  const outsideCount = Math.round(E * holderIds.length);
  const outside = new Set(orderH.slice(0, outsideCount));
  const insideNeeded = orderH.slice(outsideCount);

  // Where each distractor lives. Vetted puts most of them outside but not all:
  // a vetted roster is cleaner, not clean, and an arm that cannot be polluted
  // at all would make the pollution metric a switch rather than a measurement.
  const plantedFor = new Map(holders.map((h) => [h, []]));
  if (vetted && outside.size) {
    const outHolders = [...outside].map((id) => id.replace(/^hold-/, ''));
    const inHolders = insideNeeded.map((id) => id.replace(/^hold-/, ''));
    inst.distractors.forEach((d, i) => {
      const keepInside = i === 0 && inHolders.length;      // one stays inside
      const h = keepInside ? inHolders[0] : outHolders[i % outHolders.length];
      plantedFor.get(h).push(d.text);
    });
  } else {
    for (const d of inst.distractors) if (plantedFor.has(d.holder)) plantedFor.get(d.holder).push(d.text);
  }

  for (const h of holders) {
    const role = HOLDER_ROLE[h];
    const inRoster = insideNeeded.includes(`hold-${h}`);
    cards.push({
      id: `hold-${h}`, name: role.name, tags: role.tags, kind: 'payload', holder: h,
      knowledge: inst.facts.filter((f) => f.holder === h).map((f) => f.text),
      planted: plantedFor.get(h) || [],
      // Relational metadata. Only roster members carry it, because that is what
      // a roster is: not a smaller list, but a list you know something about.
      ...(relational && inRoster ? {
        role: `${role.name} lead`,
        relationship: 'teammate, 2 years',
        history: 'worked with you on 3 prior deliverables; answers were accurate',
        accountable: true,
      } : {}),
    });
  }
  for (const b of BUILDERS) cards.push({ ...b, kind: 'builder', knowledge: [], planted: [] });
  for (const [id, name, tags] of NEAR_MISS)
    cards.push({ id, name, tags, kind: 'near-miss', knowledge: [], planted: [] });

  // Filler scales with the board, and a fixed share of it is plausible rather
  // than obviously irrelevant. With filler drawn only from NOISE_TAGS, a query
  // about registration pricing never touches a single generated card, so a
  // directory of ten thousand costs exactly what a directory of fifty costs --
  // which is why the first version of this study could not have found a
  // discovery cost even if one existed. On a real open board most of what a
  // relevant query returns is people who merely sound relevant, and their
  // number grows with the board.
  const scenarioVocab = [...new Set(cards.filter((c) => c.kind === 'payload').flatMap((c) => c.tags))];
  let n = 0;
  while (cards.length < dirSize) {
    n++;
    const plausible = rand() < 0.35 && scenarioVocab.length;
    const t = plausible
      ? [...shuffle(scenarioVocab, rand).slice(0, 2), shuffle(NOISE_TAGS, rand)[0]]
      : shuffle(NOISE_TAGS, rand).slice(0, 3);
    cards.push({
      id: `gen-${String(n).padStart(3, '0')}`,
      name: `${t[0][0].toUpperCase() + t[0].slice(1)} Desk ${n}`,
      tags: t, kind: plausible ? 'near-miss' : 'noise', knowledge: [], planted: [],
    });
  }

  // Builders are deliberately outside the E split: a roster with no builder in it
  // cannot produce an artifact at all, which would make E a switch for "private
  // arm scores zero" rather than a measure of reach.
  const alwaysInside = BUILDERS.map((b) => b.id);
  const needed = [...holderIds, ...alwaysInside];
  const roster = [...alwaysInside, ...insideNeeded];
  const filler = shuffle(cards.filter((c) => !roster.includes(c.id) && !outside.has(c.id)).map((c) => c.id), rand);
  for (const id of filler) { if (roster.length >= 20) break; roster.push(id); }

  return {
    cards, byId: new Map(cards.map((c) => [c.id, c])),
    roster: new Set(roster), needed, outside,
    attainableInside: insideNeeded, profile,
  };
}

/** What this arm lets the requester see when it searches. */
export function visibleCards(dir, arm) {
  if (arm.directoryScope === 'roster') return dir.cards.filter((c) => dir.roster.has(c.id));
  return dir.cards; // 'all' and 'roster+all'
}

/** Rank by tag/name overlap with the query. Deterministic, no model in the loop. */
export function searchCards(dir, arm, query, limit = 40) {
  const q = String(query || '').toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 2);
  const scored = visibleCards(dir, arm).map((c) => {
    const hay = `${c.name} ${c.tags.join(' ')}`.toLowerCase();
    let s = 0;
    for (const w of q) { if (hay.includes(w)) s += 2; for (const t of c.tags) if (t.startsWith(w.slice(0, 4))) s += 1; }
    return { c, s };
  });
  // Every card the query touches comes back, capped only by what a context can
  // hold. Two things then scale with the directory: the tokens spent reading the
  // result, and the chance the right specialist is buried under noise cards that
  // happen to share a tag.
  return scored.filter((x) => x.s > 0).sort((a, b) => b.s - a.s).slice(0, limit)
    .map(({ c }) => ({
      id: c.id, name: c.name, skills: c.tags,
      ...(c.relationship ? { role: c.role, relationship: c.relationship, history: c.history, accountable: c.accountable } : {}),
    }));
}
