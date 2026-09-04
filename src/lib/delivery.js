// A beat that never produced an artifact is not a score of zero. It is a missing
// observation, and averaging it in as 0 makes an outage look like an effect.
//
// This module exists because that is exactly what happened: the N sweep lost 27%
// of its beats to `TypeError: fetch failed`, those losses were averaged in as
// F1 = 0, and the resulting curve was read as "openness degrades with directory
// size". It did not. See docs/NSCAN-RETRACTION.md.
//
// Every analyzer prints this table BEFORE its contrasts, near the top, where it
// cannot be skimmed past.

/** Per-cell delivery, plus a verdict on whether contrasts are safe to read. */
export function deliveryReport(rows, dims = ['arm']) {
  const cells = new Map();
  for (const r of rows) {
    const key = dims.map((d) => `${d}=${r[d]}`).join(' ');
    const c = cells.get(key) || { key, beats: 0, lost: 0 };
    for (const b of r.beats || []) { c.beats += 1; if (!b.parsed) c.lost += 1; }
    cells.set(key, c);
  }
  const list = [...cells.values()].map((c) => ({ ...c, rate: c.beats ? c.lost / c.beats : 0 }));
  const beats = list.reduce((n, c) => n + c.beats, 0);
  const lost = list.reduce((n, c) => n + c.lost, 0);
  const worst = list.reduce((a, b) => (b.rate > a.rate ? b : a), list[0] || { rate: 0, key: '-' });
  const spread = Math.max(...list.map((c) => c.rate)) - Math.min(...list.map((c) => c.rate));
  return {
    cells: list.sort((a, b) => b.rate - a.rate),
    beats, lost, rate: beats ? lost / beats : 0, worst, spread,
    // Uneven loss is the dangerous case: it silently reweights the cells being
    // compared. Even loss only costs power.
    verdict: spread > 0.15 ? 'UNSAFE' : spread > 0.05 ? 'CAUTION' : 'OK',
  };
}

export function formatDelivery(rep, { pct = (x) => `${(x * 100).toFixed(0)}%` } = {}) {
  const L = [];
  L.push('## Delivery (read this before any contrast below)');
  L.push('');
  L.push(`- beats: ${rep.beats}, no artifact: ${rep.lost} (${pct(rep.rate)})`);
  L.push(`- worst cell: ${rep.worst.key} at ${pct(rep.worst.rate)}; spread across cells ${pct(rep.spread)}`);
  L.push('');
  L.push('| cell | beats | no artifact | rate |');
  L.push('|---|---|---|---|');
  for (const c of rep.cells) L.push(`| ${c.key} | ${c.beats} | ${c.lost} | ${pct(c.rate)} |`);
  L.push('');
  if (rep.verdict === 'UNSAFE') {
    L.push('> **UNSAFE — do not read the contrasts below as effects.** Delivery differs by more');
    L.push('> than 15 points across cells, so the cells being compared are not the same');
    L.push('> population. Every mean below counts a lost beat as F1 = 0. Re-run the affected');
    L.push('> cells, or recompute conditional on delivery and report the delivery rate itself.');
  } else if (rep.verdict === 'CAUTION') {
    L.push('> **CAUTION.** Delivery is uneven across cells. Check that the contrasts survive');
    L.push('> when lost beats are dropped rather than scored as 0.');
  }
  L.push('');
  return L.join('\n');
}
