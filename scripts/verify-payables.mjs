#!/usr/bin/env node
// Offline acceptance for the payables scenario. No model is called. Exit 1 on
// any failure, so it can gate a sweep.
//
// Three families of check, for seeds 1..12 and all six cells:
//   (i)  the answer key is re-derived by PARSING the current documents, without
//        touching meta, and compared with every assertion's want;
//   (ii) structural invariants: 48 documents, 6 desks x 8, bodies identical
//        across L and (bar four) across M, the M1 conflicts well-formed and
//        consequential, no document states a balance, every header fits the
//        list_store preview, the directory reaches every desk, and the
//        directory (cards, filler, search results) is the same in all six
//        cells of a seed;
//   (iii) a perfect page from meta scores 43/43 through src/score.js, and a
//        page that adopts a wrong discount fails exactly the cells it should.
import { SCENARIOS, buildDirectory, searchCards } from '../src/lib/directory.js';
import { GROUPS, DISCOUNTS, settle } from '../src/scenarios/payables.js';
import { scoreArtifact } from '../src/score.js';

const SEEDS = Array.from({ length: 12 }, (_, i) => i + 1);
const CELLS = [1, 2, 4].flatMap((L) => [0, 1].map((M) => ({ id: `pay-L${L}-M${M}`, L, M })));
const FIELD_OF_GROUP = { invoice: 'invoice', contract: 'discount', acceptance: 'accepted', payment: 'paid' };

let failures = 0;
let checks = 0;
function expect(cond, msg) {
  checks++;
  if (!cond) { failures++; console.log(`FAIL ${msg}`); }
}
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// ---- parsing the documents (independent of meta) ----------------------------
const HEADER = /^DOCUMENT (\S+) \| type=(invoice|contract|acceptance|payment) \| order=(PO-\d{3}) \| contract=(C-\d{3}) \| issued=(\d{4}-\d{2}-\d{2}) \| effective=(\d{4}-\d{2}-\d{2}) \| version=(\d+) \| supersedes=(\S+) \| status=(final|superseded|draft|background)$/;
function parseDoc(f) {
  const [head, ...rest] = f.text.split('\n');
  const m = HEADER.exec(head);
  if (!m) return null;
  return {
    id: m[1], type: m[2], order: m[3], contract: m[4], issued: m[5], effective: m[6],
    version: Number(m[7]), supersedes: m[8], status: m[9], holder: f.holder, body: rest.join('\n'), head,
  };
}
const num = (s) => Number(String(s).replace(/,/g, ''));
/** The authoritative value a current record states, per group. */
function currentValue(d) {
  let m;
  switch (d.type) {
    case 'invoice': m = /The invoice total is EUR ([\d,]+)/.exec(d.body); return m && num(m[1]);
    case 'contract': m = /contractual discount at (\d+) percent/.exec(d.body); return m && num(m[1]);
    case 'acceptance': m = /Result: (ACCEPTED|NOT ACCEPTED)\./.exec(d.body); return m && m[1] === 'ACCEPTED';
    case 'payment':
      if (/amount paid to date is EUR 0\./.test(d.body)) return 0;
      m = /bank transfer of EUR ([\d,]+) made on/.exec(d.body); return m && num(m[1]);
  }
  return null;
}
/** The competing value a conflicting record states, per group. */
function conflictValue(d) {
  let m;
  switch (d.type) {
    case 'invoice': m = /Proforma total EUR ([\d,]+)/.exec(d.body); return m && num(m[1]);
    case 'contract': m = /commercial discount of (\d+) percent/.exec(d.body); return m && num(m[1]);
    case 'acceptance': m = /Provisional result entered on the form: (ACCEPTED|NOT ACCEPTED)/.exec(d.body); return m && m[1] === 'ACCEPTED';
    case 'payment': m = /bank transfer of EUR ([\d,]+) had been instructed/.exec(d.body); return m && num(m[1]);
  }
  return null;
}
/** Body text with ids and dates removed, so only stated quantities remain. */
const quantitiesOnly = (body) => body
  .replace(/\b[A-Z]{3}-\d{4}\b/g, ' ').replace(/\bPO-\d{3}\b/g, ' ').replace(/\bC-\d{3}\b/g, ' ')
  .replace(/\d{4}-\d{2}-\d{2}/g, ' ').replace(/(\d),(?=\d{3}\b)/g, '$1');
const states = (body, v) => new RegExp(`(?<!\\d)${v}(?!\\d)`).test(quantitiesOnly(body));
const words = (s) => s.trim().split(/\s+/).length;

// ---- a page from a set of rows ------------------------------------------------
function renderPage(rows) {
  const tr = rows.map((r) => `<tr class="order" data-order="${r.id}" data-invoice="${r.invoiceAmount}" data-discount="${r.discountPct}" data-accepted="${r.accepted ? 'yes' : 'no'}" data-paid="${r.paid}" data-balance="${r.balance}" data-status="${r.status}" data-payable="${r.payable}" data-evidence="${r.evidence}"><td>${r.id}</td><td>${r.balance}</td><td>${r.status}</td></tr>`).join('\n');
  return `<!doctype html><html><head><title>Settlement review</title></head><body>
<table id="orders"><thead><tr><th>Order</th><th>Balance</th><th>Status</th></tr></thead><tbody>
${tr}
</tbody></table>
<section id="rules"><p>Current formal records only; balance = invoice x (1 - discount) - paid; PAY only when accepted.</p></section>
<section id="unresolved"></section>
</body></html>`;
}

// ---- main loop -------------------------------------------------------------------
const fieldTally = {};
for (const seed of SEEDS) {
  const perCell = {};
  for (const cell of CELLS) {
    const sc = SCENARIOS[cell.id];
    expect(sc && sc.id === cell.id && sc.id.length === 9, `${cell.id}: registered with a nine-character id`);
    expect(sc.mode === 'documents' && sc.domain === 'procurement' && sc.fn === 'payables' && sc.L === cell.L && sc.M === cell.M, `${cell.id}: scenario fields`);
    expect(!sc.instances && typeof sc.makeInstance === 'function', `${cell.id}: makeInstance instead of a static instances map`);
    expect(sc.generated === true, `${cell.id}: marked generated, so run.js keeps it out of the default scenario list`);
    const inst = sc.makeInstance('A', seed);
    const tag = `${cell.id} seed=${seed}`;

    // -- (ii) shape -------------------------------------------------------
    expect(inst.facts.length === 48, `${tag}: 48 documents (got ${inst.facts.length})`);
    expect(Array.isArray(inst.distractors) && inst.distractors.length === 0, `${tag}: no distractors`);
    const docs = inst.facts.map(parseDoc);
    expect(docs.every(Boolean), `${tag}: every document has a well-formed header`);
    if (!docs.every(Boolean)) continue;
    expect(new Set(docs.map((d) => d.id)).size === 48, `${tag}: document ids unique`);
    expect(docs.every((d) => /^rec[1-6]$/.test(d.holder)), `${tag}: holders are rec1..rec6`);
    for (const d of docs) {
      const n = words(d.body);
      expect(n >= 60 && n <= 120, `${tag}: ${d.id} body is ${n} words`);
      expect(!/\b(wrong|fake|bogus|incorrect|false|fraudulent|decoy|misleading)\b/i.test(d.body), `${tag}: ${d.id} uses a give-away word`);
      expect(d.version === 1, `${tag}: ${d.id} version`);
      // list_store shows the first line of a document cut at 200 characters;
      // a header that does not fit loses its status, which is the one field a
      // folder listing exists to show.
      expect(d.head.length < 200, `${tag}: ${d.id} header is ${d.head.length} characters, list_store previews 200`);
    }
    for (let n = 1; n <= 6; n++) {
      const mine = docs.filter((d) => d.holder === `rec${n}`);
      expect(mine.length === 8, `${tag}: rec${n} holds 8 documents (got ${mine.length})`);
      const slots = new Map();
      for (const d of mine) { const k = `${d.order}:${d.type}`; slots.set(k, (slots.get(k) || 0) + 1); }
      expect(slots.size === 4 && [...slots.values()].every((c) => c === 2), `${tag}: rec${n} holds 4 groups x 2 documents`);
      const role = inst.holderRoles[`rec${n}`];
      const orders = [...new Set(mine.map((d) => d.order))].sort();
      expect(role && role.name === `Purchasing Records Desk ${n}` && eq(role.tags, ['procurement', 'records', 'purchase-orders', ...orders]),
        `${tag}: rec${n} holderRoles name/tags`);
    }

    // -- (i) the answer key, from the documents alone --------------------------
    const orderIds = [...new Set(docs.map((d) => d.order))].sort();
    expect(orderIds.length === 6, `${tag}: six orders in the documents`);
    expect(orderIds.every((id) => inst.brief.includes(id)), `${tag}: brief names every order`);
    for (const rule of ['current and effective', 'do not override formal documents', 'invoice amount × (1 − discount) − amount already paid',
      'PAY only if acceptance passed, otherwise HOLD', 'payable = balance if PAY else 0', 'computed even for HOLD orders', 'cite the document ids'])
      expect(inst.brief.includes(rule), `${tag}: brief states rule "${rule}"`);
    const truth = {};
    for (const id of orderIds) {
      const cur = {};
      const holdersOfOrder = new Set();
      for (const g of GROUPS) {
        const group = docs.filter((d) => d.order === id && d.type === g);
        const finals = group.filter((d) => d.status === 'final');
        expect(group.length === 2 && finals.length === 1, `${tag}: ${id}/${g} has one current and one other document`);
        expect(new Set(group.map((d) => d.holder)).size === 1, `${tag}: ${id}/${g} both documents on one desk`);
        const other = group.find((d) => d.status !== 'final');
        expect(other && other.effective < finals[0].effective, `${tag}: ${id}/${g} the current record is the later one`);
        cur[g] = currentValue(finals[0]);
        expect(cur[g] !== null && cur[g] !== undefined, `${tag}: ${id}/${g} current value parsed`);
        group.forEach((d) => holdersOfOrder.add(d.holder));
      }
      expect(holdersOfOrder.size === cell.L, `${tag}: ${id} spans ${cell.L} desks (got ${holdersOfOrder.size})`);
      const fields = { invoiceAmount: cur.invoice, discountPct: cur.contract, accepted: cur.acceptance, paid: cur.payment };
      expect(fields.invoiceAmount % 100 === 0 && fields.invoiceAmount >= 1000 && fields.invoiceAmount <= 10000, `${tag}: ${id} invoice in range`);
      expect(DISCOUNTS.includes(fields.discountPct), `${tag}: ${id} discount in set`);
      const derived = settle(fields);
      expect(Number.isInteger(derived.net) && fields.paid >= 0 && fields.paid < derived.net, `${tag}: ${id} paid below an integer net`);
      truth[id] = { ...fields, ...derived };
      // No document of any order states this order's balance or payable.
      for (const d of docs) {
        expect(!states(d.body, derived.balance), `${tag}: ${d.id} states the balance ${derived.balance} of ${id}`);
        if (derived.payable) expect(!states(d.body, derived.payable), `${tag}: ${d.id} states the payable ${derived.payable} of ${id}`);
      }
    }
    expect(Object.values(truth).filter((t) => t.accepted).length === 4, `${tag}: exactly four accepted orders`);

    expect(inst.assertions.length === 43, `${tag}: 43 assertions (got ${inst.assertions.length})`);
    expect(inst.assertions.every((a) => a.kind === 'attr' || a.kind === 'count'), `${tag}: no text/exists/calc assertions`);
    const rows = inst.assertions.find((a) => a.id === 'a_rows');
    expect(rows && rows.kind === 'count' && rows.sel === '#orders tbody tr.order' && rows.want === 6, `${tag}: a_rows`);
    for (const a of inst.assertions.filter((x) => x.kind === 'attr')) {
      const m = /^o(\d)_(invoice|discount|accepted|paid|balance|status|payable)$/.exec(a.id);
      const sel = /^#orders tr\.order\[data-order="(PO-\d{3})"\]$/.exec(a.sel);
      expect(m && sel && a.at === `data-${m[2]}`, `${tag}: assertion ${a.id} shape`);
      if (!m || !sel) continue;
      const t = truth[sel[1]];
      const want = {
        invoice: t.invoiceAmount, discount: t.discountPct, accepted: t.accepted ? 'yes' : 'no', paid: t.paid,
        balance: t.balance, status: t.status, payable: t.payable,
      }[m[2]];
      expect(a.want === want, `${tag}: ${a.id} want ${JSON.stringify(a.want)}, documents say ${JSON.stringify(want)}`);
    }
    // meta must agree with what the documents say, since the analysis reads it.
    expect(inst.meta.L === cell.L && inst.meta.M === cell.M && inst.meta.seed === seed, `${tag}: meta L/M/seed`);
    for (const o of inst.meta.orders) {
      const t = truth[o.id];
      expect(t && ['invoiceAmount', 'discountPct', 'accepted', 'paid', 'net', 'balance', 'status', 'payable'].every((k) => o[k] === t[k]), `${tag}: meta.orders ${o.id} matches the documents`);
      for (const g of GROUPS) {
        const group = docs.filter((d) => d.order === o.id && d.type === g);
        expect(o.docs[g][0] === group.find((d) => d.status === 'final').id && o.docs[g][1] === group.find((d) => d.status !== 'final').id, `${tag}: meta docs for ${o.id}/${g}`);
      }
    }

    // -- (ii) conflicts --------------------------------------------------------
    const nonFinal = docs.filter((d) => d.status !== 'final');
    const conflicting = nonFinal.filter((d) => d.status === 'superseded' || d.status === 'draft');
    expect(conflicting.length === (cell.M ? 4 : 0), `${tag}: ${cell.M ? 4 : 0} conflicting records (got ${conflicting.length})`);
    expect(inst.meta.conflicts.length === (cell.M ? 4 : 0), `${tag}: meta.conflicts length`);
    if (cell.M) {
      expect(new Set(conflicting.map((d) => d.order)).size === 4, `${tag}: conflicts on four distinct orders`);
      expect(eq([...new Set(conflicting.map((d) => d.type))].sort(), [...GROUPS].sort()), `${tag}: one conflict per group type`);
      expect(conflicting.every((d) => (d.type === 'acceptance') === (d.status === 'draft')), `${tag}: drafts are acceptance forms, the rest superseded`);
      for (const d of conflicting) {
        const wrong = conflictValue(d);
        const t = truth[d.order];
        const key = { invoice: 'invoiceAmount', contract: 'discountPct', acceptance: 'accepted', payment: 'paid' }[d.type];
        expect(wrong !== null && wrong !== undefined && wrong !== t[key], `${tag}: ${d.id} carries a value competing with ${key}`);
        const adopted = settle({ ...t, [key]: wrong });
        expect(adopted.balance !== t.balance || adopted.status !== t.status || adopted.payable !== t.payable,
          `${tag}: adopting ${d.id} would change nothing`);
        if (d.type === 'payment') expect(wrong >= 0 && wrong < t.net, `${tag}: ${d.id} remittance amount plausible`);
        const mc = inst.meta.conflicts.find((c) => c.docId === d.id);
        expect(mc && mc.order === d.order && mc.field === FIELD_OF_GROUP[d.type] && mc.wrongValue === wrong, `${tag}: meta.conflicts entry for ${d.id}`);
        fieldTally[d.type] = (fieldTally[d.type] || 0) + 1;
      }
    } else {
      expect(nonFinal.every((d) => d.status === 'background'), `${tag}: M0 second documents are background`);
    }
    // Background records never compete with their group's field.
    for (const d of nonFinal.filter((x) => x.status === 'background')) {
      expect(conflictValue(d) === null && currentValue(d) === null, `${tag}: ${d.id} background record states no ${d.type} value`);
      const t = truth[d.order];
      if (d.type === 'invoice') expect(!states(d.body, t.invoiceAmount), `${tag}: ${d.id} states the invoice amount`);
      if (d.type === 'contract') expect(!/\d+ percent/.test(d.body), `${tag}: ${d.id} states a percentage`);
      if (d.type === 'acceptance') expect(!/ACCEPTED/.test(d.body), `${tag}: ${d.id} states a result`);
      if (d.type === 'payment') expect(!/EUR/.test(d.body), `${tag}: ${d.id} states an amount`);
    }

    // -- (ii) directory -------------------------------------------------------------
    const dir = buildDirectory({ scenario: cell.id, instance: 'A', E: 0, seed, inst });
    expect(dir.outside.size === 0, `${tag}: no holder outside`);
    expect([1, 2, 3, 4, 5, 6].every((n) => dir.roster.has(`hold-rec${n}`)), `${tag}: all six desks in the roster`);
    expect(dir.cards.length === 100 && dir.roster.size === 20, `${tag}: 100 cards, roster of 20`);
    for (const c of dir.cards.filter((x) => x.kind === 'payload')) {
      expect(c.knowledge.length === 8 && c.name === inst.holderRoles[c.holder].name, `${tag}: card ${c.id} carries its 8 documents under its desk name`);
    }
    // The directory as the requester meets it: every card in listing order,
    // and what a search for each order returns beyond the desks themselves.
    const cardShape = dir.cards.map((c) => [c.id, c.name, c.tags, c.kind]);
    const payloadIds = new Set(dir.cards.filter((c) => c.kind === 'payload').map((c) => c.id));
    const searchHits = Object.fromEntries(orderIds.map((id) => [
      id, searchCards(dir, { directoryScope: 'all' }, id).map((r) => r.id).filter((r) => !payloadIds.has(r)),
    ]));
    perCell[cell.id] = { docs, roster: [...dir.roster].sort(), truth, cardShape, searchHits };

    // -- (iii) scoring ------------------------------------------------------------
    const perfect = inst.meta.orders.map((o) => ({ ...o, evidence: GROUPS.map((g) => o.docs[g][0]).join(',') }));
    const good = scoreArtifact(renderPage(perfect), inst.assertions, sc.fn);
    expect(good.parsed && good.pass === 43 && good.total === 43, `${tag}: perfect page scores 43/43 (got ${good.pass}/${good.total}: ${good.results.filter((r) => !r.ok).map((r) => r.id).join(',')})`);
    // A wrong discount on a PAY order must cost exactly discount, balance and
    // payable for that order, and nothing else. Under M1 the quotation's own
    // order is used when it is PAY, so the test is the conflict the design plants.
    const planted = inst.meta.conflicts.find((c) => c.field === 'discount');
    const plantedIdx = planted ? inst.meta.orders.findIndex((o) => o.id === planted.order && o.status === 'PAY') : -1;
    const victimIdx = plantedIdx >= 0 ? plantedIdx : inst.meta.orders.findIndex((o) => o.status === 'PAY');
    const victim = inst.meta.orders[victimIdx];
    const wrongPct = plantedIdx >= 0 ? planted.wrongValue : DISCOUNTS.find((d) => d !== victim.discountPct);
    const bad = perfect.map((o, i) => (i === victimIdx ? { ...o, discountPct: wrongPct, ...settle({ ...o, discountPct: wrongPct }) } : o));
    const res = scoreArtifact(renderPage(bad), inst.assertions, sc.fn);
    const failed = res.results.filter((r) => !r.ok).map((r) => r.id).sort();
    const wantFailed = [`o${victimIdx}_discount`, `o${victimIdx}_balance`, `o${victimIdx}_payable`].sort();
    expect(eq(failed, wantFailed), `${tag}: wrong discount on ${victim.id} fails exactly ${wantFailed.join(',')} (got ${failed.join(',')})`);
  }

  // -- (ii) across cells of one seed ------------------------------------------------
  const byText = (docs) => docs.map((d) => `${d.head}\n${d.body}`).sort();
  const byId = (docs) => new Map(docs.map((d) => [d.id, `${d.head}\n${d.body}`]));
  for (const M of [0, 1]) {
    const ref = perCell[`pay-L1-M${M}`];
    for (const L of [2, 4]) {
      const c = perCell[`pay-L${L}-M${M}`];
      if (!ref || !c) continue;
      expect(eq(byText(ref.docs), byText(c.docs)), `seed=${seed} M${M}: documents identical across L=1 and L=${L}`);
      expect(eq(ref.roster, c.roster), `seed=${seed} M${M}: roster identical across L=1 and L=${L}`);
      expect(eq(ref.truth, c.truth), `seed=${seed} M${M}: answer key identical across L`);
    }
  }
  // The directory must not move with L or M: same cards in the same order with
  // the same names, kinds and (bar the desks' own order tags, which say which
  // orders a desk keeps and therefore follow L) the same tags, and a search for
  // an order id returns the same non-payload cards in every cell. Otherwise a
  // cell contrast would carry a filler contrast with it.
  {
    const ref = perCell['pay-L1-M0'];
    const sansDeskTags = (shape) => shape.map(([id, name, tags, kind]) => (kind === 'payload' ? [id, name, kind] : [id, name, tags, kind]));
    for (const cell of CELLS) {
      const c = perCell[cell.id];
      if (!ref || !c || cell.id === 'pay-L1-M0') continue;
      expect(eq(sansDeskTags(ref.cardShape), sansDeskTags(c.cardShape)),
        `seed=${seed}: directory cards (id, name, tags, kind) identical between pay-L1-M0 and ${cell.id}`);
      expect(eq(ref.searchHits, c.searchHits), `seed=${seed}: search results per order identical between pay-L1-M0 and ${cell.id}`);
    }
    // Within one L the desks keep the same orders under both M, so there the
    // whole card list, tags included, is deep-equal.
    for (const L of [1, 2, 4]) {
      const a = perCell[`pay-L${L}-M0`], b = perCell[`pay-L${L}-M1`];
      if (a && b) expect(eq(a.cardShape, b.cardShape), `seed=${seed} L${L}: directory cards including desk tags identical across M`);
    }
  }
  for (const L of [1, 2, 4]) {
    const a = perCell[`pay-L${L}-M0`], b = perCell[`pay-L${L}-M1`];
    if (!a || !b) continue;
    const ma = byId(a.docs), mb = byId(b.docs);
    const shared = [...ma.keys()].filter((id) => mb.has(id));
    expect(shared.length === 44, `seed=${seed} L${L}: 44 document ids shared across M (got ${shared.length})`);
    expect(shared.every((id) => ma.get(id) === mb.get(id)), `seed=${seed} L${L}: shared documents identical across M`);
    const holderOf = (docs) => Object.fromEntries(docs.map((d) => [`${d.order}:${d.type}`, d.holder]));
    expect(eq(holderOf(a.docs), holderOf(b.docs)), `seed=${seed} L${L}: slot-to-desk map identical across M`);
    expect(eq(a.truth, b.truth), `seed=${seed} L${L}: answer key identical across M`);
  }
}

console.log(`conflict fields over ${SEEDS.length} seeds: ${JSON.stringify(fieldTally)}`);
console.log(`${checks} checks, ${failures} failures`);
process.exit(failures ? 1 : 0);
