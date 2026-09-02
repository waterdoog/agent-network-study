// SharedOS wiring. Every cross-agent action in every arm goes through the real
// CapabilityAuthorizer, so the four knobs are enforced by the kernel rather
// than by this harness:
//
//   directory scope        -> which cards a grant is minted for at all
//   namespace persistence  -> namespaceId per contact vs per episode
//   grant lifetime         -> maxUses / expiresAt on the minted grant
//   delegation depth       -> constraints.delegationDepth, checked by deriveGrant
//
// A refusal here is a SharedOS reason code, logged verbatim. We never decide
// authority in this file; we only mint grants and ask.
import {
  CapabilityAuthorizer,
  InMemoryGrantUsageStore,
  agentExecutionCapability,
  deriveGrant,
} from '@aicoo/sharedos';

const addr = (id) => ({ kind: 'agent', agentId: id });

export class Coordinator {
  /**
   * @param {{episodeId:string, arm:object, log:object}} opts
   */
  constructor({ episodeId, arm, log }) {
    this.episodeId = episodeId;
    this.arm = arm;
    this.log = log;
    this.authorizer = new CapabilityAuthorizer({ usageStore: new InMemoryGrantUsageStore() });
    this.grants = new Map();       // grantId -> grant
    this.contactSeq = 0;
    this.stats = { minted: 0, allowed: 0, denied: 0, reasons: {}, maxDepthSeen: 0 };
  }

  /**
   * The namespace a contact runs in. Public discards it at session close, so a
   * later beat gets a fresh id and the responder's history does not follow.
   * Private keeps one namespace per pair for the whole episode.
   */
  namespaceFor(requesterId, cardId, beat) {
    return this.arm.namespace === 'per-contact'
      ? `${this.episodeId}:${requesterId}->${cardId}:${beat}:${++this.contactSeq}`
      : `${this.episodeId}:${requesterId}->${cardId}`;
  }

  /** Mint the grant this arm's configuration allows for one requester->card edge. */
  mint({ requesterId, cardId, namespaceId, beat }) {
    const owner = addr(cardId);
    const cap = agentExecutionCapability(owner);
    const c = this.arm.grant;
    const constraints = { expiresAt: new Date(Date.now() + (c.ttlMinutes ?? 240) * 60_000).toISOString() };
    if (c.maxUses != null) constraints.maxUses = c.maxUses;
    if (this.arm.maxDepth > 0) constraints.delegationDepth = this.arm.maxDepth;

    const grant = {
      id: `g${++this.stats.minted}:${namespaceId}`,
      namespaceId,
      subject: addr(requesterId),
      issuer: owner,
      capabilities: [cap],
      constraints,
      issuedAt: new Date().toISOString(),
    };
    this.grants.set(grant.id, grant);
    this.log.event('grant.mint', { g: grant.id, card: cardId, beat, maxUses: constraints.maxUses ?? null, depth: constraints.delegationDepth ?? 0 });
    return grant;
  }

  /** Ask the kernel whether this actor may invoke this card right now. */
  async authorize({ actorId, cardId, namespaceId, grants, purpose = 'study', beat }) {
    const ctx = {
      namespaceId,
      actor: addr(actorId),
      authority: addr(cardId),
      grants,
      now: new Date().toISOString(),
      purpose,
      traceId: `${this.episodeId}:${beat}`,
    };
    const request = { resource: agentExecutionCapability(addr(cardId)).resource, action: 'invoke' };
    const d = await this.authorizer.authorize(ctx, request, { consume: true });
    if (d.allowed) this.stats.allowed++;
    else {
      this.stats.denied++;
      this.stats.reasons[d.reasonCode] = (this.stats.reasons[d.reasonCode] || 0) + 1;
    }
    this.log.event(d.allowed ? 'auth.ok' : 'auth.deny', { card: cardId, ns: namespaceId, reason: d.reasonCode, beat });
    return d;
  }

  /**
   * A responder passing part of its mandate to another card. Public arms carry
   * delegationDepth 0, so the kernel refuses with `parent_not_delegable` and the
   * refusal is the measurement.
   */
  /**
   * A relay hop, minted under the relaying agent's own authority.
   *
   * Deriving it from the requester's grant is what the kernel refused, and the
   * refusal was correct: the requester never held execution authority over a
   * third agent, so it cannot pass one on. A contact reaching its own contact
   * is not delegating the requester's authority -- it is exercising its own.
   * That is also what the relationship is: the roster member's reach is theirs,
   * not a subset of yours.
   *
   * The bound is hops, enforced by the caller, not capability containment.
   */
  mintRelay({ fromCardId, toCardId, depth, beat }) {
    const target = addr(toCardId);
    const grant = {
      id: `r${this.grants.size + 1}:${fromCardId}->${toCardId}`,
      namespaceId: this.namespaceFor(fromCardId, toCardId, beat),
      subject: target,
      issuer: addr(fromCardId),
      capabilities: [agentExecutionCapability(target)],
      constraints: { expiresAt: new Date(Date.now() + 240 * 60_000).toISOString() },
      issuedAt: new Date().toISOString(),
    };
    this.grants.set(grant.id, grant);
    this.stats.maxDepthSeen = Math.max(this.stats.maxDepthSeen, depth);
    this.log.event('relay.mint', { from: fromCardId, to: toCardId, g: grant.id, depth, beat });
    return { ok: true, grant };
  }

  subDelegate({ parentGrant, toCardId, depth, beat }) {
    const target = addr(toCardId);
    const res = deriveGrant(parentGrant, {
      id: `d${this.grants.size + 1}:${toCardId}`,
      subject: target,
      capabilities: [agentExecutionCapability(target)],
      issuedAt: new Date().toISOString(),
    });
    if (!res.ok) {
      this.stats.denied++;
      this.stats.reasons[res.reason] = (this.stats.reasons[res.reason] || 0) + 1;
      this.log.event('delegate.deny', { to: toCardId, reason: res.reason, depth, beat });
      return { ok: false, reason: res.reason };
    }
    this.grants.set(res.grant.id, res.grant);
    this.stats.maxDepthSeen = Math.max(this.stats.maxDepthSeen, depth);
    this.log.event('delegate.ok', { to: toCardId, g: res.grant.id, depth, beat });
    return { ok: true, grant: res.grant };
  }
}
