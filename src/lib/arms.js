// The only thing that differs between conditions. One kernel, one runtime, one
// model; three configuration objects.
//
// requesterMemory is true everywhere on purpose. Withholding the requester's own
// notes from the public arm would manufacture the warm-start result; what the
// study compares is bilateral versus unilateral memory, not memory versus none.

export const ARMS = {
  public: {
    id: 'public',
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
    namespace: arm.peripheryNamespace,
    responderMemory: false,
    grant: arm.peripheryGrant,
    maxDepth: arm.peripheryMaxDepth,
  };
}
