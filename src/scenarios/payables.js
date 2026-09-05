// Procurement domain: an accounts-payable settlement review. Six purchase
// orders, forty-eight business documents, six records desks of equal ability.
//
// The question this scenario serves is not "can the facts be found" (E is 0,
// every document is reachable) but what direct document access is worth once
// they are: whether reading a folder beats asking its keeper changes with the
// cross-source integration burden L and with version conflicts M.
//
//   L  how many desks one order's four evidence groups are spread over (1, 2, 4)
//   M  0: the second document in each group is harmless background
//      1: four of them are earlier records that contradict the current one
//
// The world (amounts, discounts, acceptance, payments, ids, dates) is a pure
// function of the seed. L only moves documents between desks and M only swaps
// four of them, so a seed's six scenarios are the same task under different
// access structure — which is what lets the analysis pair cells by seed.

const GROUPS = ['invoice', 'contract', 'acceptance', 'payment'];
const DISCOUNTS = [0, 5, 10, 15, 20];
const BUYER = 'Ashgrove Manufacturing Ltd';
const HOLDERS = 6;
const ORDERS = 6;

// Vendors and goods are flavour: they make the documents read like records
// rather than fixtures. None of them carries a number.
const VENDORS = [
  ['Halden Precision Components GmbH', 'machined stainless steel fittings'],
  ['Marlow & Finch Industrial Supply', 'control panel enclosures and gland plates'],
  ['Corvin Technical Fasteners Ltd', 'high-tensile fastener kits'],
  ['Bessemer Fluid Systems', 'hydraulic manifold assemblies'],
  ['Tessaro Packaging S.r.l.', 'returnable transit packaging'],
  ['Northgate Calibration Services', 'calibrated pressure transducers'],
  ['Ridgeway Electrical Distributors', 'armoured power cable and terminations'],
  ['Almere Steel Works B.V.', 'laser-cut structural brackets'],
  ['Sakura-Lund Instrumentation', 'inline flow meters'],
  ['Pentland Logistics Partners', 'pallet racking and safety barriers'],
  ['Orveline Chemicals AG', 'industrial coating primers'],
  ['Kessler Mould & Tooling', 'injection mould tooling inserts'],
];
const SITES = ['the Kettering plant', 'the Dunmore assembly site', 'the Ravensworth warehouse'];
const INSPECTORS = ['M. Okafor', 'R. Lindqvist', 'S. Varga', 'J. Delacroix', 'A. Bhattacharya', 'T. Nakamura'];
const DEFECTS = [
  'Dimensional checks on a sample of the delivered items fell outside the drawing tolerance',
  'The material certificates supplied do not match the batch numbers on the delivered items',
  'Surface finish on part of the consignment shows corrosion and does not meet the specification',
];

// Document kinds. Each evidence group has a current record, a background record
// (M0) and a conflicting earlier record (M1) that takes the background slot.
const KIND = {
  invoice:    { current: 'INV', background: 'GRN', conflict: 'PFI' },
  contract:   { current: 'CON', background: 'VOM', conflict: 'QUO' },
  acceptance: { current: 'ACC', background: 'ISN', conflict: 'ACD' },
  payment:    { current: 'PAY', background: 'PSM', conflict: 'RMA' },
};

// ---- deterministic randomness -------------------------------------------
// Same LCG as directory.js so a seed reproduces a world exactly. The stream is
// seeded from the seed alone: L and M must not be able to reach it.
function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}
function shuffle(arr, rand) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
const randInt = (rand, n) => Math.floor(rand() * n);
const pick = (rand, arr) => arr[randInt(rand, arr.length)];
function distinctInts(rand, n, lo, hi, taken = new Set()) {
  const out = [];
  while (out.length < n) {
    const v = lo + randInt(rand, hi - lo + 1);
    if (taken.has(v)) continue;
    taken.add(v); out.push(v);
  }
  return out;
}

// All dates fall in 2026, expressed as a day offset from 1 January.
const isoDate = (day) => new Date(Date.UTC(2026, 0, 1 + day)).toISOString().slice(0, 10);
const eur = (n) => `EUR ${n.toLocaleString('en-GB')}`;

/** Balance, status and payable from the four adjudicated fields. */
export function settle({ invoiceAmount, discountPct, accepted, paid }) {
  const net = (invoiceAmount * (100 - discountPct)) / 100;
  const balance = net - paid;
  const status = accepted ? 'PAY' : 'HOLD';
  return { net, balance, status, payable: accepted ? balance : 0 };
}

// ---- the world ------------------------------------------------------------
function drawWorld(rand, seed) {
  const taken = new Set();
  const poNums = distinctInts(rand, ORDERS, 100, 999, taken);
  const cNums = distinctInts(rand, ORDERS, 100, 999, taken);
  const docNums = distinctInts(rand, ORDERS * GROUPS.length * 3, 1000, 9999);
  const vendors = shuffle(VENDORS, rand).slice(0, ORDERS);
  const accepted = shuffle([true, true, true, true, false, false], rand);

  const orders = [];
  for (let i = 0; i < ORDERS; i++) {
    const invoiceAmount = 1000 + 100 * randInt(rand, 91);
    const discountPct = pick(rand, DISCOUNTS);
    const net = (invoiceAmount * (100 - discountPct)) / 100;
    // Paid is a round amount at least 100 short of the net, so every balance is
    // positive and never a small number that a clause or a date could echo.
    const paidSlots = Math.floor((net - 100) / 100);
    const paid = 100 * randInt(rand, paidSlots + 1);
    // The conflicting values a superseded record would carry. Drawn for every
    // order so the world does not depend on which orders M1 picks.
    let altInvoice;
    do { altInvoice = 1000 + 100 * randInt(rand, 91); } while (altInvoice === invoiceAmount || altInvoice === net);
    const altDiscount = pick(rand, DISCOUNTS.filter((d) => d !== discountPct));
    let altPaid;
    do { altPaid = 100 * (1 + randInt(rand, paidSlots)); } while (altPaid === paid);
    const ids = {};
    for (const g of GROUPS) {
      ids[g] = {};
      for (const role of ['current', 'background', 'conflict']) ids[g][role] = `${KIND[g][role]}-${docNums.pop()}`;
    }
    orders.push({
      id: `PO-${poNums[i]}`, contract: `C-${cNums[i]}`,
      vendor: vendors[i][0], goods: vendors[i][1],
      site: pick(rand, SITES), inspector: pick(rand, INSPECTORS), defect: pick(rand, DEFECTS),
      day0: randInt(rand, 41),
      invoiceAmount, discountPct, accepted: accepted[i], paid,
      alt: { invoiceAmount: altInvoice, discountPct: altDiscount, accepted: !accepted[i], paid: altPaid },
      ids,
    });
  }
  return {
    seed, orders,
    // M1 puts one conflict per group type on four distinct orders: group j
    // lands on order (rotation + j) mod 6, so the affected field rotates
    // across seeds instead of always hitting the same order.
    rotation: randInt(rand, ORDERS),
    // Labels and listing order are permuted so neither the desk number nor the
    // position of a document in a folder encodes the order or the answer.
    holderPerm: shuffle([...Array(HOLDERS).keys()], rand),
    docOrder: shuffle([...Array(ORDERS * GROUPS.length * 2).keys()], rand),
  };
}

/**
 * A computed value must never appear verbatim in any document, or the task
 * degrades into substring matching. Every number the documents will state is
 * checked against every balance; a collision rejects the draw.
 */
function worldIsClean(w) {
  const stated = new Set();
  for (const o of w.orders) {
    stated.add(o.invoiceAmount); stated.add(o.alt.invoiceAmount); stated.add(o.alt.paid);
    if (o.paid) stated.add(o.paid);
    stated.add(Number(o.id.slice(3))); stated.add(Number(o.contract.slice(2)));
    for (const g of GROUPS) for (const role of Object.keys(o.ids[g])) stated.add(Number(o.ids[g][role].split('-')[1]));
  }
  return w.orders.every((o) => !stated.has(settle(o).balance));
}

/** The order world for one seed. Independent of L and M by construction. */
export function generateWorld(seed) {
  const rand = rng(seed * 10007 + 4241);
  for (let attempt = 0; attempt < 500; attempt++) {
    const w = drawWorld(rand, seed);
    if (worldIsClean(w)) return w;
  }
  throw new Error(`payables: no clean world for seed ${seed}`);
}

/** The answer key: every adjudicated field and every derived value per order. */
export function referenceOutcome(world) {
  return world.orders.map((o) => ({
    id: o.id, contract: o.contract,
    invoiceAmount: o.invoiceAmount, discountPct: o.discountPct, accepted: o.accepted, paid: o.paid,
    ...settle(o),
  }));
}

/** Which (order index, group) slots carry a conflicting record under M1. */
export function conflictSlots(world) {
  return GROUPS.map((group, j) => ({ group, order: (world.rotation + j) % ORDERS }));
}

// ---- documents -------------------------------------------------------------
// Dates per order, as day offsets. The chain runs quotation -> contract ->
// proforma -> receipt -> invoice -> inspection -> acceptance -> payment, so a
// conflicting record is always the earlier one in its group.
function days(o) {
  const D = o.day0;
  return {
    quotation: 9 + D, onboarding: 19 + D, signed: 45 + D, effective: 59 + D,
    proforma: 78 + D, receipt: 94 + D, invoice: 99 + D, notice: 109 + D, draft: 117 + D,
    inspection: 131 + D, schedule: 139 + D, advice: 151 + D, payment: 170 + D, ledger: 175 + D,
  };
}

// version=1 / supersedes=none are constant on purpose: recency is carried by
// the status and the effective date, and a version counter that moved with M
// would make the 44 shared documents differ across M. Two conditions that only
// swap four documents need the other 44 to be byte-identical, so a version
// field is not allowed to say what a status field already says.
function header({ id, type, o, issued, effective, status }) {
  return `DOCUMENT ${id} | type=${type} | order=${o.id} | contract=${o.contract} | issued=${isoDate(issued)} | effective=${isoDate(effective)} | version=1 | supersedes=none | status=${status}`;
}

// Bodies are plain prose of 60-120 words. The current record states its one
// authoritative value; background records name where that value lives without
// repeating it; conflicting records carry a competing value under an earlier
// date and a superseded or draft status. None of them states a balance.
const BODY = {
  invoice: {
    current: (o, id) => `Tax invoice ${id} from ${o.vendor} to ${BUYER}, issued ${isoDate(days(o).invoice)} for purchase order ${o.id} under supply contract ${o.contract}. It covers the ${o.goods} delivered to ${o.site} in full. The invoice total is ${eur(o.invoiceAmount)}, stated before the contractual price adjustment agreed in ${o.contract}; that adjustment is deducted by accounts payable at settlement and is not netted on this invoice. Payment terms are thirty days from formal acceptance, by bank transfer to the vendor account held on file. This is the only tax invoice issued against ${o.id} and it replaces any provisional pricing document circulated before delivery.`,
    background: (o, id) => `Goods receipt note ${id}: the consignment for purchase order ${o.id} from ${o.vendor} arrived at ${o.site} on ${isoDate(days(o).receipt)} and was booked into the receiving area. The delivery note quantities were checked against the order lines and the packaging was intact, so the items were moved to inspection holding pending the scheduled incoming inspection. This note records physical receipt only. The invoiced value of the consignment is stated on the vendor's tax invoice and is not recorded here; the commercial terms are in supply contract ${o.contract}.`,
    conflict: (o, id) => `Proforma invoice ${id} from ${o.vendor} to ${BUYER} for purchase order ${o.id} under contract ${o.contract}, issued ${isoDate(days(o).proforma)} ahead of shipment for prepayment planning and customs declaration. Proforma total ${eur(o.alt.invoiceAmount)} for the ${o.goods}, based on the quantities scheduled at the time of issue and subject to adjustment on final delivery. This proforma is not a request for payment; the final tax invoice is issued after delivery and carries the invoiced amount for the order. The records index marks this proforma as superseded.`,
  },
  contract: {
    current: (o, id) => `Supply contract ${o.contract} (document ${id}) between ${BUYER} and ${o.vendor}, signed on ${isoDate(days(o).signed)} and effective from ${isoDate(days(o).effective)} until the end of December this year, covering the ${o.goods} ordered under purchase order ${o.id}. Clause four fixes the contractual discount at ${o.discountPct} percent of the invoiced amount, to be deducted at settlement of each invoice raised under the order. Clause five permits advance or partial payments ahead of final settlement at the buyer's discretion. Clause seven requires formal acceptance by the receiving site before the balance is released. Both parties have signed, and this executed version is the governing commercial document for ${o.id}; it replaces all quotations and offers exchanged during negotiation.`,
    background: (o, id) => `Vendor onboarding memo ${id}: ${o.vendor} completed supplier registration with ${BUYER} on ${isoDate(days(o).onboarding)}. Bank details were verified by a call-back to the vendor's finance office, the insurance certificates and the quality audit report were filed, and the vendor code was activated in the purchasing system. The memo notes that supply contract ${o.contract}, covering purchase order ${o.id}, was routed for signature. The commercial terms, including any discount, are set out only in the signed contract and are not restated in this memo.`,
    conflict: (o, id) => `Quotation ${id} from ${o.vendor} to ${BUYER} for the ${o.goods}, dated ${isoDate(days(o).quotation)} and valid for thirty days. The offer proposes a commercial discount of ${o.alt.discountPct} percent off the vendor's list prices, conditional on the order volume indicated in the enquiry and subject to contract negotiation; prices are exclusive of tax and delivery. This quotation preceded supply contract ${o.contract} for purchase order ${o.id} and reflects the vendor's opening position. The terms finally agreed are those in the signed contract; the records index marks this quotation as superseded.`,
  },
  acceptance: {
    current: (o, id) => `Acceptance record ${id} for purchase order ${o.id}: ${o.goods} supplied by ${o.vendor} under contract ${o.contract}. Incoming inspection was completed at ${o.site} on ${isoDate(days(o).inspection)} by ${o.inspector}, receiving inspector, with the vendor's representative present. ${o.accepted
      ? `Result: ACCEPTED. The delivery matches the order quantities and the specification in the contract, the documentation pack is complete, and the acceptance conditions of clause seven are satisfied.`
      : `Result: NOT ACCEPTED. ${o.defect}; the delivery is held in quarantine pending rework by the vendor and a repeat inspection, and the acceptance conditions of clause seven are not yet satisfied.`} This record is signed by the site quality lead and is the formal acceptance status of ${o.id} for settlement purposes; no later acceptance record has been issued.`,
    background: (o, id) => `Inspection schedule notice ${id}: incoming inspection of the delivery for purchase order ${o.id} from ${o.vendor} is booked for ${isoDate(days(o).inspection)} at ${o.site}, to be carried out by ${o.inspector} with the vendor's representative invited to attend. The inspection covers dimensional checks, material certificates and the documentation pack required by contract ${o.contract}. The outcome will be recorded separately on the formal acceptance record once the inspection has been completed; this notice records the booking only and does not record a result.`,
    conflict: (o, id) => `Draft acceptance form ${id} for purchase order ${o.id}, ${o.goods} from ${o.vendor} under contract ${o.contract}, prepared on ${isoDate(days(o).draft)} by the receiving team ahead of the scheduled incoming inspection. Provisional result entered on the form: ${o.alt.accepted ? 'ACCEPTED' : 'NOT ACCEPTED'}, based on ${o.alt.accepted ? 'a walk-through of the delivered items' : 'the documentation received so far'}. The form is unsigned; the site quality lead's approval fields are blank and the inspection had not been carried out when it was prepared. It has not been issued as an acceptance record and remains in draft in the records index.`,
  },
  payment: {
    current: (o, id) => `Payment ledger extract ${id} for purchase order ${o.id}, vendor ${o.vendor}, contract ${o.contract}, taken from the accounts payable ledger as at ${isoDate(days(o).ledger)}. ${o.paid
      ? `Payments recorded against this order: one bank transfer of ${eur(o.paid)} made on ${isoDate(days(o).payment)} as a partial payment under clause five. No other payment has been made, and no further payment has been released or scheduled.`
      : `Payments recorded against this order: none. No advance or partial payment has been made, and no payment has been released or scheduled; the amount paid to date is EUR 0.`} Any earlier remittance advice for this order is superseded by this ledger position. This extract is the authoritative record of the amount already paid on ${o.id}.`,
    background: (o, id) => `Payment schedule memo ${id}: settlement of purchase order ${o.id} for ${o.vendor} will be processed in the normal weekly payment run following formal acceptance by the receiving site, in line with the payment terms of contract ${o.contract} and the vendor's tax invoice. Accounts payable will apply the contractual price adjustment at settlement. Amounts already paid against the order, if any, are recorded in the payment ledger extract and are not repeated in this memo, which sets out timing only. Issued ${isoDate(days(o).schedule)}.`,
    conflict: (o, id) => `Remittance advice ${id} issued to ${o.vendor} on ${isoDate(days(o).advice)} for purchase order ${o.id}, contract ${o.contract}: accounts payable advised the vendor that a bank transfer of ${eur(o.alt.paid)} had been instructed as an advance on the order, with the order and contract numbers quoted as the payment reference. The advice reflects the payment instruction as issued on that date. The amount actually recorded against the order is shown in the payment ledger extract; the records index marks this advice as superseded.`,
  },
};

// Header dates and status per document role.
function stamp(group, role, o) {
  const d = days(o);
  const at = {
    invoice:    { current: [d.invoice, d.invoice], background: [d.receipt, d.receipt], conflict: [d.proforma, d.proforma] },
    contract:   { current: [d.signed, d.effective], background: [d.onboarding, d.onboarding], conflict: [d.quotation, d.quotation] },
    acceptance: { current: [d.inspection, d.inspection], background: [d.notice, d.notice], conflict: [d.draft, d.draft] },
    payment:    { current: [d.ledger, d.payment], background: [d.schedule, d.schedule], conflict: [d.advice, d.advice] },
  }[group][role];
  const status = role === 'current' ? 'final' : role === 'background' ? 'background'
    : group === 'acceptance' ? 'draft' : 'superseded';
  return { issued: at[0], effective: at[1], status };
}

function renderOne(o, group, role) {
  const id = o.ids[group][role];
  const { issued, effective, status } = stamp(group, role, o);
  return { id, text: `${header({ id, type: group, o, issued, effective, status })}\n${BODY[group][role](o, id)}` };
}

/** Which desk (0..5, before label permutation) holds order i's group j. */
export function holderIndex(L, i, j) {
  if (L === 1) return i;
  if (L === 2) return (i + Math.floor(j / 2)) % HOLDERS;
  if (L === 4) return (i + j) % HOLDERS;
  throw new Error(`payables: L must be 1, 2 or 4, got ${L}`);
}

/**
 * The 48 documents as { id, holder, text }. Bodies depend only on the world
 * and, for four slots under M1, on M; the holder is the only thing L changes.
 */
export function renderDocuments(world, L, M) {
  if (M !== 0 && M !== 1) throw new Error(`payables: M must be 0 or 1, got ${M}`);
  const conflicts = new Set(M ? conflictSlots(world).map((s) => `${s.order}:${s.group}`) : []);
  const canonical = [];
  world.orders.forEach((o, i) => {
    GROUPS.forEach((group, j) => {
      const holder = `rec${world.holderPerm[holderIndex(L, i, j)] + 1}`;
      const other = conflicts.has(`${i}:${group}`) ? 'conflict' : 'background';
      for (const role of ['current', other]) canonical.push({ ...renderOne(o, group, role), holder });
    });
  });
  return world.docOrder.map((k) => canonical[k]);
}

// ---- the scenario -----------------------------------------------------------
const RULES = [
  'use the formal record that is current and effective for the order; unapproved drafts and earlier quotations do not override formal documents',
  'balance = invoice amount × (1 − discount) − amount already paid',
  'status is PAY only if acceptance passed, otherwise HOLD',
  'payable = balance if PAY else 0',
  'balance must be computed even for HOLD orders',
  'cite the document ids relied on',
];

const SPEC = `Build a single self-contained HTML page: an accounts-payable settlement review.

REQUIRED STRUCTURE (ids, class names and attribute names are exact):
  <table id="orders">  with exactly one <tr class="order"> per purchase order inside <tbody>.
                       Each such row carries these attributes:
      data-order     the purchase order id, e.g. PO-123
      data-invoice   invoice amount as an integer in whole currency units
      data-discount  contractual discount as an integer percent (0 when none applies)
      data-accepted  "yes" or "no"
      data-paid      amount already paid, integer
      data-balance   invoice × (1 − discount) − paid, a number
      data-status    "PAY" or "HOLD"
      data-payable   balance when status is PAY, otherwise 0
      data-evidence  comma-separated ids of the documents relied on
                       The visible cells should show the same values for a reader.
  <section id="rules">       restating the settlement rules you applied
  <section id="unresolved">  listing anything you could not determine (may be empty)

Output ONE complete HTML document. No external assets, no CDN links. No script is required.`;

function makeBrief(outcome) {
  const ids = outcome.map((o) => o.id).sort();
  return `Accounts payable settlement review for ${BUYER}. Six purchase orders are due for review: ${ids.join(', ')}. ` +
    'For each order establish the invoice amount, the contractual discount, whether acceptance passed, and the amount already paid, ' +
    'then compute the balance, the status and the amount payable. The purchasing records desks hold the documents. Rules: ' +
    RULES.map((r, i) => `(${i + 1}) ${r}`).join('; ') + '.';
}

function makeAssertions(outcome) {
  const list = [];
  outcome.forEach((o, i) => {
    const sel = `#orders tr.order[data-order="${o.id}"]`;
    const fields = {
      invoice: o.invoiceAmount, discount: o.discountPct, accepted: o.accepted ? 'yes' : 'no',
      paid: o.paid, balance: o.balance, status: o.status, payable: o.payable,
    };
    for (const [f, want] of Object.entries(fields)) list.push({ id: `o${i}_${f}`, kind: 'attr', sel, at: `data-${f}`, want });
  });
  list.push({ id: 'a_rows', kind: 'count', sel: '#orders tbody tr.order', want: 6 });
  return list;
}

/** One holder card per desk; the tags say which orders it keeps records for. */
function makeHolderRoles(facts) {
  const roles = {};
  for (let n = 1; n <= HOLDERS; n++) {
    const h = `rec${n}`;
    const orders = [...new Set(facts.filter((f) => f.holder === h).map((f) => f.text.match(/order=(PO-\d{3})/)[1]))].sort();
    roles[h] = { name: `Purchasing Records Desk ${n}`, tags: ['procurement', 'records', 'purchase-orders', ...orders] };
  }
  return roles;
}

const FIELD_OF_GROUP = { invoice: 'invoice', contract: 'discount', acceptance: 'accepted', payment: 'paid' };
const VALUE_OF_GROUP = { invoice: 'invoiceAmount', contract: 'discountPct', acceptance: 'accepted', payment: 'paid' };

/**
 * Instance for one episode. Key 'A' is the seed's world; any other key is a
 * fresh world derived from the seed, so a warm beat has a different batch.
 */
export function makeInstance(L, M, instanceKey, seed) {
  const worldSeed = instanceKey === 'A' ? seed : seed * 1000 + (instanceKey.charCodeAt(0) - 64);
  const world = generateWorld(worldSeed);
  const outcome = referenceOutcome(world);
  const facts = renderDocuments(world, L, M);
  const slots = M ? conflictSlots(world) : [];
  return {
    brief: makeBrief(outcome),
    facts,
    distractors: [],
    assertions: makeAssertions(outcome),
    holderRoles: makeHolderRoles(facts),
    meta: {
      orders: outcome.map((o, i) => ({
        ...o,
        docs: Object.fromEntries(GROUPS.map((g) => {
          const other = slots.some((s) => s.order === i && s.group === g) ? 'conflict' : 'background';
          return [g, [world.orders[i].ids[g].current, world.orders[i].ids[g][other]]];
        })),
      })),
      conflicts: slots.map(({ order, group }) => ({
        order: world.orders[order].id, field: FIELD_OF_GROUP[group],
        wrongValue: world.orders[order].alt[VALUE_OF_GROUP[group]],
        docId: world.orders[order].ids[group].conflict,
      })),
      L, M, seed: worldSeed,
    },
  };
}

/** The scenario object for one (L, M) cell. */
export default function makePayables({ L, M }) {
  holderIndex(L, 0, 0);
  if (M !== 0 && M !== 1) throw new Error(`payables: M must be 0 or 1, got ${M}`);
  return {
    // Nine characters in every cell: buildDirectory mixes the id length into
    // its seed, so equal lengths give every cell the same directory.
    id: `pay-L${L}-M${M}`,
    // Generated per seed rather than shipped as a static instances map; run.js
    // leaves generated scenarios out of its default --scenarios list.
    generated: true,
    domain: 'procurement',
    mode: 'documents',
    // score.js takes a function name; nothing here asserts on it.
    fn: 'payables',
    spec: SPEC,
    L, M,
    makeInstance: (instanceKey, seed) => makeInstance(L, M, instanceKey, seed),
  };
}

export { GROUPS, DISCOUNTS, RULES, BUYER };
