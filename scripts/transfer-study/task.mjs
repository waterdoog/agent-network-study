import { createHash } from 'node:crypto';

export function rng(seed) {
  let state = seed >>> 0;
  return () => {
    let t = state += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
export const hash = x => createHash('sha256').update(typeof x === 'string' ? x : JSON.stringify(x)).digest('hex');
const seed32 = s => createHash('sha256').update(s).digest().readUInt32LE(0);
export function shuffled(xs, random) {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function makeWorld(seed) {
  if (!Number.isSafeInteger(seed) || seed < 0) throw new Error('Nonnegative integer seed required');
  const random = rng(seed32(`portfolio-transfer-v1:${seed}`));
  const integer = (a, b) => a + Math.floor(random() * (b - a + 1));
  const projects = Array.from({ length: 8 }, (_, i) => ({
    id: `P${i + 1}`, cost: integer(2, 9), hours: integer(1, 7), benefit: integer(4, 20),
  }));
  const pairs = [];
  for (let i = 0; i < 8; i++) for (let j = i + 1; j < 8; j++) pairs.push([projects[i].id, projects[j].id]);
  const conflictIndex = integer(0, pairs.length - 1);
  const conflict = pairs.splice(conflictIndex, 1)[0];
  const synergy = { pair: pairs[integer(0, pairs.length - 1)], bonus: integer(5, 12) };
  const budgets = {
    funds: Math.floor(0.35 * projects.reduce((s, p) => s + p.cost, 0)),
    hours: Math.floor(0.40 * projects.reduce((s, p) => s + p.hours, 0)),
    max_projects: 3,
  };
  const domains = shuffled(['costs', 'operations', 'benefits'], random);
  const holders = domains.map((domain, i) => ({
    id: `H${i + 1}`, domain,
    description: {
      costs: 'Project monetary costs',
      operations: 'Project labor hours and project incompatibility',
      benefits: 'Project benefits and pair synergy',
    }[domain],
  }));
  return { schema: 1, seed, id: `W${seed}`, projects, budgets, conflict, synergy,
    project_order: shuffled(projects.map(p => p.id), random),
    holders: shuffled(holders, random) };
}

export function factsFor(world, holderId) {
  const holder = world.holders.find(h => h.id === holderId);
  if (!holder) throw new Error('Unknown holder');
  if (holder.domain === 'costs') return { costs: world.projects.map(p => ({ project: p.id, cost: p.cost })) };
  if (holder.domain === 'operations') return {
    labor: world.projects.map(p => ({ project: p.id, hours: p.hours })),
    incompatible_pair: world.conflict,
  };
  return {
    benefits: world.projects.map(p => ({ project: p.id, benefit: p.benefit })),
    synergy: world.synergy,
  };
}

export function publicTask(world) {
  return {
    task: 'Select a project portfolio maximizing total benefit subject to all constraints.',
    projects: world.project_order, budgets: world.budgets,
    rules: [
      'Select at most three distinct project IDs. Each project can be selected at most once.',
      'Total monetary cost cannot exceed funds; total labor hours cannot exceed hours.',
      'One incompatible pair cannot both be selected.',
      'Benefit is the sum of selected project base benefits plus a synergy bonus if both projects in the synergy pair are selected.',
      'All costs, hours, benefits, incompatibility and synergy facts are held by the listed specialists.',
      'Submit only your selected project IDs using submit_selection. Any optimal tie is accepted.',
    ],
    directory: world.holders.map(({ id, description }) => ({ id, description })),
  };
}

export function scoreSelection(world, selection) {
  if (!Array.isArray(selection)) return { valid: false, feasible: false, value: 0, reason: 'missing-or-invalid-selection' };
  if (selection.some(x => typeof x !== 'string') || new Set(selection).size !== selection.length)
    return { valid: false, feasible: false, value: 0, reason: 'invalid-or-duplicate-project' };
  const byId = new Map(world.projects.map(p => [p.id, p]));
  if (selection.some(x => !byId.has(x))) return { valid: false, feasible: false, value: 0, reason: 'unknown-project' };
  const chosen = selection.map(id => byId.get(id));
  const cost = chosen.reduce((s, p) => s + p.cost, 0);
  const hours = chosen.reduce((s, p) => s + p.hours, 0);
  const value = chosen.reduce((s, p) => s + p.benefit, 0)
    + (world.synergy.pair.every(id => selection.includes(id)) ? world.synergy.bonus : 0);
  const feasible = selection.length <= world.budgets.max_projects && cost <= world.budgets.funds
    && hours <= world.budgets.hours && !world.conflict.every(id => selection.includes(id));
  return { valid: true, feasible, value, cost, hours, reason: feasible ? 'feasible' : 'constraint-violation' };
}

export function solveWorld(world) {
  let optimum = -Infinity;
  const optimalSelections = [];
  for (let mask = 0; mask < (1 << world.projects.length); mask++) {
    const selected = world.projects.filter((_, i) => mask & (1 << i)).map(p => p.id);
    const result = scoreSelection(world, selected);
    if (!result.feasible) continue;
    if (result.value > optimum) { optimum = result.value; optimalSelections.length = 0; }
    if (result.value === optimum) optimalSelections.push(selected);
  }
  if (!(optimum > 0)) throw new Error('World lacks a positive feasible optimum; do not silently replace it');
  return { optimum, optimal_selections: optimalSelections, enumerated_subsets: 1 << world.projects.length };
}

export function evaluate(world, selection) {
  const solution = solveWorld(world);
  const result = scoreSelection(world, selection);
  return { ...result, optimum: solution.optimum,
    normalized_utility: result.feasible ? result.value / solution.optimum : 0,
    exact_optimal: result.feasible && result.value === solution.optimum };
}

export function episodePlan(config, mode) {
  if (!['formal', 'smoke'].includes(mode)) throw new Error('mode must be formal or smoke');
  const seeds = mode === 'smoke' ? config.smoke_seeds
    : Array.from({ length: config.formal_seeds.last - config.formal_seeds.first + 1 }, (_, i) => i + config.formal_seeds.first);
  const plan = seeds.flatMap((seed, i) => {
    const arms = ['strict', 'permissive'];
    if (mode === 'smoke' || i % config.full_information_stride === 0) arms.push('full_information');
    return arms.map(arm => ({ id: `W${seed}_${arm}`, seed, arm }));
  });
  return shuffled(plan, rng(config.order_seed));
}
