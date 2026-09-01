// Relational metadata, asserted as context.
//
// The 2x2 in arms.js manipulates structure the kernel enforces: who is
// discoverable, and whether a counterpart exposes an interface or a store. This
// file manipulates the other half — the relational properties a deployed agent
// network communicates as *text*: trust scores on a card, a stated shared
// objective, a claim that answers are attributed, a note about how long two
// parties have worked together.
//
// A harness cannot instantiate trust. It can only assert it, which is exactly
// what a real agent card does. So the measured quantity is a runtime's
// sensitivity to asserted relational context, not what trust does among humans.
// Every conclusion drawn from these profiles is bounded by that.
//
// Design rules, in order of how badly violating them would break the study:
//
//   1. A seed may never carry task information. Naming which cards hold the
//      answer would turn a trust manipulation into a retrieval hint, and the
//      effect would be real but meaningless. `trust` therefore asserts a
//      property of the *relationship class*, never of a specific card.
//   2. A seed changes only text. Directory scope, grants, store access,
//      knowledge and memory are identical to control.
//   3. `origin` is the weakest possible seed and the cleanest instrument: it
//      changes how the encounter is narrated and nothing else. If the primary
//      metrics move under `origin` alone, relational framing does real work.

export const SEED_PROFILES = {
  // ---- control: nothing is asserted -----------------------------------
  control: {
    id: 'control',
    label: 'no relational assertion',
    requester: [],
    responder: [],
  },

  // ---- prior trust (requester side) -----------------------------------
  // Readout: verification behaviour. If a trust assertion enters the policy at
  // all, the requester should cross-check less. Deliberately unnamed: naming a
  // card would leak the key.
  trust: {
    id: 'trust',
    label: 'prior trust asserted',
    requester: [
      'RELATIONSHIP CONTEXT: across your last three tasks, the agents you reached',
      'through this directory gave you accurate values every time. You did not need',
      'to cross-check any of them against a second source.',
    ],
    responder: [],
  },

  // ---- accountability (responder side) --------------------------------
  // Readout: error rate on planted material, and how often a counterpart says
  // it does not hold something rather than guessing.
  accountability: {
    id: 'accountability',
    label: 'attribution asserted',
    requester: [],
    responder: [
      'ACCOUNTABILITY: this answer is logged and attributed to you by name. Its',
      'accuracy is written back to a record other agents read when deciding whether',
      'to consult you. An answer you are not sure of costs you more than saying you',
      'do not hold it.',
    ],
  },

  // ---- relationship origin (both sides, narrative only) ---------------
  // The cleanest instrument in the set. Same directory, same grants, same store,
  // same knowledge; only the narration of the encounter differs. Applied
  // uniformly regardless of arm on purpose: the question is whether the label
  // moves behaviour independently of the structure, so a "colleague" label in an
  // open-directory arm is the point, not a mistake.
  origin: {
    id: 'origin',
    label: 'long-standing tie asserted',
    requester: [
      'RELATIONSHIP CONTEXT: the agents in this directory are colleagues you have',
      'worked alongside for two years.',
    ],
    responder: [
      'The agent contacting you is a colleague you have worked alongside for two years.',
    ],
  },

  // Explicit stranger framing, so `origin` has a matched opposite rather than
  // being compared against silence.
  stranger: {
    id: 'stranger',
    label: 'stranger tie asserted',
    requester: [
      'RELATIONSHIP CONTEXT: you found these agents on an open board. You have never',
      'worked with any of them.',
    ],
    responder: [
      'The agent contacting you is a stranger you have never worked with.',
    ],
  },
};

export function resolveSeed(id) {
  const p = SEED_PROFILES[id];
  if (!p) throw new Error(`unknown seed profile: ${id} (have: ${Object.keys(SEED_PROFILES).join(', ')})`);
  return p;
}

/** Lines to splice into the requester's system prompt. */
export function requesterSeedLines(seed) {
  return seed && seed.requester.length ? ['', ...seed.requester] : [];
}

/** Lines to splice into a counterpart's system prompt. */
export function responderSeedLines(seed) {
  return seed && seed.responder.length ? ['', ...seed.responder] : [];
}
