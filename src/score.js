#!/usr/bin/env node
// Deterministic scorer. Runs as its own process so a model-produced infinite
// loop kills one child instead of the sweep, and so a failing artifact can be
// re-scored by hand:  node src/score.js art.html assertions.json fnName
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';

/**
 * @param {string} html  the artifact
 * @param {Array}  assertions
 * @param {string} fnName the global function the spec requires
 */
export function scoreArtifact(html, assertions, fnName) {
  const out = { parsed: false, fnPresent: false, results: [], pass: 0, total: assertions.length, errors: [] };
  let dom, win, doc, text;
  try {
    dom = new JSDOM(html, { runScripts: 'dangerously', pretendToBeVisual: false });
    win = dom.window; doc = win.document;
    text = (doc.body?.textContent || '').replace(/\s+/g, ' ');
    out.parsed = true;
  } catch (e) {
    out.errors.push(`parse: ${e.message}`);
    out.results = assertions.map((a) => ({ id: a.id, ok: false, why: 'parse-failed' }));
    return out;
  }

  const fn = typeof win[fnName] === 'function' ? win[fnName] : null;
  out.fnPresent = Boolean(fn);

  for (const a of assertions) {
    let ok = false, why = '', got;
    try {
      switch (a.kind) {
        case 'exists':
          got = doc.querySelector(a.sel) ? 1 : 0; ok = got === 1; break;
        case 'count':
          got = doc.querySelectorAll(a.sel).length; ok = got === a.want; break;
        case 'attr': {
          const el = doc.querySelector(a.sel);
          got = el ? el.getAttribute(a.at) : null;
          ok = got != null && normNum(got) === normNum(a.want);
          break;
        }
        case 'text': {
          const wants = a.anyOf || [a.want];
          got = wants.find((w) => text.includes(String(w))) ?? null;
          ok = got != null;
          break;
        }
        case 'calc': {
          if (!fn) { why = 'fn-missing'; break; }
          got = fn(...structuredClone(a.args));
          ok = typeof a.want === 'number'
            ? typeof got === 'number' && Number.isFinite(got) && Math.abs(got - a.want) < 0.005
            : String(got) === String(a.want);
          break;
        }
        default: why = `unknown-kind:${a.kind}`;
      }
    } catch (e) {
      why = `threw:${String(e.message).slice(0, 80)}`;
    }
    if (ok) out.pass++;
    out.results.push({ id: a.id, ok, got: brief(got), why: ok ? '' : (why || 'mismatch') });
  }

  try { win.close(); } catch { /* jsdom close is best-effort */ }
  return out;
}

const normNum = (v) => { const n = Number(v); return Number.isFinite(n) ? n : String(v).trim(); };
const brief = (v) => (v == null ? null : String(v).slice(0, 40));

if (import.meta.url === `file://${process.argv[1]}`) {
  const [htmlPath, assertPath, fnName] = process.argv.slice(2);
  const res = scoreArtifact(readFileSync(htmlPath, 'utf8'), JSON.parse(readFileSync(assertPath, 'utf8')), fnName);
  process.stdout.write(JSON.stringify(res));
}
