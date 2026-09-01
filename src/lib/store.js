// The component store.
//
// This is the mechanism the study is actually about. A deliverable is built
// from k components with dependencies between them, and the arms differ in how
// a delegate gets hold of a component it depends on:
//
//   sandbox  the requester must paste the dependency's content into the
//            instructions. Cost grows with (component size x dependents).
//   store    the delegate reads it from here. The requester passes a name.
//
// Nothing about that difference is a prompt: in the sandbox arm the read tool
// does not exist, so inlining is the only route that works.

export class ComponentStore {
  constructor({ persistent }) {
    this.persistent = persistent;   // survives across beats, or cleared each beat
    this.items = new Map();         // name -> { html, writtenBy, beat, bytes }
    this.reads = 0;
    this.writes = 0;
  }

  write(name, html, { by, beat }) {
    this.items.set(name, { html, writtenBy: by, beat, bytes: html.length });
    this.writes++;
  }

  read(name) {
    const it = this.items.get(name);
    if (it) this.reads++;
    return it || null;
  }

  list() {
    return [...this.items.entries()].map(([name, v]) => ({ name, bytes: v.bytes, beat: v.beat }));
  }

  /** Between beats: a non-persistent store forgets everything built so far. */
  endBeat() {
    if (!this.persistent) this.items.clear();
  }

  stats() {
    return { reads: this.reads, writes: this.writes, held: this.items.size };
  }
}

/**
 * What a requester must hand a delegate for one component.
 *
 * With a store the dependency travels as a name. Without one it travels as
 * bytes, every time, for every dependent. `inlineBytes` is the sandbox tax and
 * is what the k-scan measures.
 */
export function buildBrief({ component, deps, store, canRead }) {
  if (canRead) {
    return {
      text: deps.length
        ? `This component depends on: ${deps.join(', ')}. Call read_component on each before you start.`
        : 'This component has no dependencies.',
      inlineBytes: 0,
    };
  }
  const parts = [];
  let bytes = 0;
  for (const d of deps) {
    const it = store.read(d);
    if (!it) { parts.push(`(${d} is not available)`); continue; }
    parts.push(`--- ${d} (previously produced) ---\n${it.html}`);
    bytes += it.html.length;
  }
  return {
    text: parts.length ? `This component depends on the following, reproduced in full:\n\n${parts.join('\n\n')}` : 'This component has no dependencies.',
    inlineBytes: bytes,
  };
}
