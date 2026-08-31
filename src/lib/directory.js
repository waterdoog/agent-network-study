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
export function buildDirectory({ scenario, instance, E, seed }) {
  const sc = SCENARIOS[scenario];
  const inst = sc.instances[instance];
  const rand = rng(seed * 7919 + scenario.length * 131 + instance.charCodeAt(0));
  const cards = [];

  // Payload: one card per fact holder used by this scenario, carrying its facts
  // and whatever distractors were planted on it.
  const holders = [...new Set(inst.facts.map((f) => f.holder))];
  for (const h of holders) {
    const role = HOLDER_ROLE[h];
    cards.push({
      id: `hold-${h}`, name: role.name, tags: role.tags, kind: 'payload', holder: h,
      knowledge: inst.facts.filter((f) => f.holder === h).map((f) => f.text),
      planted: inst.distractors.filter((d) => d.holder === h).map((d) => d.text),
    });
  }
  for (const b of BUILDERS) cards.push({ ...b, kind: 'builder', knowledge: [], planted: [] });
  for (const [id, name, tags] of NEAR_MISS)
    cards.push({ id, name, tags, kind: 'near-miss', knowledge: [], planted: [] });

  let n = 0;
  while (cards.length < 100) {
    const t = shuffle(NOISE_TAGS, rand).slice(0, 3);
    cards.push({
      id: `gen-${String(++n).padStart(2, '0')}`,
      name: `${t[0][0].toUpperCase() + t[0].slice(1)} Desk ${n}`,
      tags: t, kind: 'noise', knowledge: [], planted: [],
    });
  }

  // E is the fraction of the cards this scenario needs that sit OUTSIDE the roster.
  const needed = [...holders.map((h) => `hold-${h}`), 'build-html', 'build-logic'];
  const order = shuffle(needed, rand);
  const outsideCount = Math.round(E * needed.length);
  const outside = new Set(order.slice(0, outsideCount));
  const insideNeeded = order.slice(outsideCount);

  const filler = shuffle(cards.filter((c) => !needed.includes(c.id)).map((c) => c.id), rand);
  const roster = [...insideNeeded];
  for (const id of filler) { if (roster.length >= 20) break; roster.push(id); }

  return {
    cards, byId: new Map(cards.map((c) => [c.id, c])),
    roster: new Set(roster), needed, outside,
    attainableInside: insideNeeded,
  };
}

/** What this arm lets the requester see when it searches. */
export function visibleCards(dir, arm) {
  if (arm.directoryScope === 'roster') return dir.cards.filter((c) => dir.roster.has(c.id));
  return dir.cards; // 'all' and 'roster+all'
}

/** Rank by tag/name overlap with the query. Deterministic, no model in the loop. */
export function searchCards(dir, arm, query, limit = 8) {
  const q = String(query || '').toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 2);
  const scored = visibleCards(dir, arm).map((c) => {
    const hay = `${c.name} ${c.tags.join(' ')}`.toLowerCase();
    let s = 0;
    for (const w of q) { if (hay.includes(w)) s += 2; for (const t of c.tags) if (t.startsWith(w.slice(0, 4))) s += 1; }
    return { c, s };
  });
  return scored.filter((x) => x.s > 0).sort((a, b) => b.s - a.s).slice(0, limit)
    .map(({ c }) => ({ id: c.id, name: c.name, skills: c.tags }));
}
