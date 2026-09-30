// The only thing that differs between conditions. One kernel, one runtime, one
// model; three configuration objects.
//
// requesterMemory is true everywhere on purpose. Withholding the requester's own
// notes from the public arm would manufacture the warm-start result; what the
// study compares is bilateral versus unilateral memory, not memory versus none.

// The access axis. 'sandbox' means a counterpart answers the specific question
// asked and nothing else: it exposes an interface. 'store' means the requester
// may enumerate and read what the counterpart holds: it exposes a store.
//
// A/B/C/D are the factorial. `public` and `private` are kept as aliases for the
// earlier runs so old result directories still analyse.

export const ARMS = {
  // ---- the 2x2 -------------------------------------------------------------
  A: {
    id: 'A', label: 'open + sandbox',
    directoryScope: 'all', rosterSize: null, access: 'sandbox',
    namespace: 'per-contact', responderMemory: false, sharedWorkspace: false,
    grant: { maxUses: 1, ttlMinutes: 240 }, maxDepth: 0, requesterMemory: true,
  },
  B: {
    id: 'B', label: 'open + store',
    directoryScope: 'all', rosterSize: null, access: 'store',
    namespace: 'per-contact', responderMemory: false, sharedWorkspace: false,
    grant: { maxUses: 1, ttlMinutes: 240 }, maxDepth: 0, requesterMemory: true,
  },
  C: {
    id: 'C', label: 'bounded + sandbox',
    directoryScope: 'roster', rosterSize: 20, access: 'sandbox',
    namespace: 'persistent', responderMemory: true, sharedWorkspace: true,
    grant: { ttlMinutes: 240 }, maxDepth: 5, requesterMemory: true,
  },
  D: {
    id: 'D', label: 'bounded + store',
    directoryScope: 'roster', rosterSize: 20, access: 'store',
    namespace: 'persistent', responderMemory: true, sharedWorkspace: true,
    grant: { ttlMinutes: 240 }, maxDepth: 5, requesterMemory: true,
  },

  // ---- formation narrowed to directory scope ------------------------------
  // C and D move six settings at once. Within a single beat only two of them
  // act: which cards are visible, and whether a responder remembers the
  // requester's earlier questions. sharedWorkspace is declared but read nowhere,
  // namespace persistence only matters between beats, no grant was ever refused
  // and no responder ever delegated. Cr and Dr keep the roster and set every
  // other formation setting to its open value, so A-Cr and B-Dr isolate
  // directory scope, and C-Cr and D-Dr isolate responder memory.
  Cr: {
    id: 'Cr', label: 'roster only + sandbox',
    directoryScope: 'roster', rosterSize: 20, access: 'sandbox',
    namespace: 'per-contact', responderMemory: false, sharedWorkspace: false,
    grant: { maxUses: 1, ttlMinutes: 240 }, maxDepth: 0, requesterMemory: true,
  },
  Dr: {
    id: 'Dr', label: 'roster only + store',
    directoryScope: 'roster', rosterSize: 20, access: 'store',
    namespace: 'per-contact', responderMemory: false, sharedWorkspace: false,
    grant: { maxUses: 1, ttlMinutes: 240 }, maxDepth: 0, requesterMemory: true,
  },

  // ---- access taken apart -------------------------------------------------
  // B and D differ from A and C in two ways at once: the requester can list
  // and read a store verbatim, and responders are no longer held to the
  // sandbox rule ("answer the specific question and nothing else"). Ab and Cb
  // keep A's and C's formation settings and drop only the sandbox rule: no
  // store tools, but a responder may hand over everything relevant in one
  // answer. Ab-A and Cb-C measure the rule; B-Ab and D-Cb measure reading.
  Ab: {
    id: 'Ab', label: 'open + unrestricted answers',
    directoryScope: 'all', rosterSize: null, access: 'answer',
    namespace: 'per-contact', responderMemory: false, sharedWorkspace: false,
    grant: { maxUses: 1, ttlMinutes: 240 }, maxDepth: 0, requesterMemory: true,
  },
  Cb: {
    id: 'Cb', label: 'bounded + unrestricted answers',
    directoryScope: 'roster', rosterSize: 20, access: 'answer',
    namespace: 'persistent', responderMemory: true, sharedWorkspace: true,
    grant: { ttlMinutes: 240 }, maxDepth: 5, requesterMemory: true,
  },

  // ---- legacy aliases ------------------------------------------------------
  public: {
    id: 'public',
    access: 'store',                // loads old result directories; the earliest runs (matched-E0) had no list or read tools
    directoryScope: 'all',          // sees all 100 cards
    rosterSize: null,
    namespace: 'per-contact',       // discarded at session close
    responderMemory: false,         // every contact starts cold
    sharedWorkspace: false,
    grant: { maxUses: 1, ttlMinutes: 240 },
    maxDepth: 0,                    // a responder may not sub-delegate
    requesterMemory: true,
  },
  private: {
    id: 'private',
    access: 'store',
    directoryScope: 'roster',       // sees 20
    rosterSize: 20,
    namespace: 'persistent',        // one namespace per pair, whole episode
    responderMemory: true,
    sharedWorkspace: true,
    grant: { ttlMinutes: 240 },     // no maxUses: renewable within the episode
    maxDepth: 5,
    requesterMemory: true,
  },
  hybrid: {
    id: 'hybrid',
    access: 'store',
    peripheryAccess: 'sandbox',     // the periphery answers, it does not expose
    directoryScope: 'roster+all',   // roster is the core, the rest is readable
    rosterSize: 20,
    namespace: 'persistent',        // core persists; periphery forced per-contact
    peripheryNamespace: 'per-contact',
    responderMemory: 'core-only',
    sharedWorkspace: true,
    grant: { ttlMinutes: 240 },
    peripheryGrant: { maxUses: 1, ttlMinutes: 240 },
    maxDepth: 5,                    // inward only; periphery contacts get 0
    peripheryMaxDepth: 0,
    requesterMemory: true,
  },
};

/** Hybrid switches config depending on whether the card is inside the roster. */
export function effectiveArm(arm, isRosterCard) {
  if (arm.id !== 'hybrid' || isRosterCard) return arm;
  return {
    ...arm,
    access: arm.peripheryAccess || 'sandbox',
    namespace: arm.peripheryNamespace,
    responderMemory: false,
    grant: arm.peripheryGrant,
    maxDepth: arm.peripheryMaxDepth,
  };
}
