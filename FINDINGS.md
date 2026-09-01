# Findings — overnight run, 2026-09-01

Two sweeps on EC2, one model (`deepseek/deepseek-v4-flash`), the real
`@aicoo/sharedos` kernel deciding every contact, and a scorer with no model in
the loop.

| run | design | model | episodes | beats | cost | wall |
|---|---|---|---|---|---|---|
| `main` | E ∈ {0.3, 0.7} — private reach is restricted | flash | 54 | 216 | $1.29 | 122 min |
| `matched-E0` | **E = 0 — public and private have identical reach** | flash | 27 | 108 | $0.61 | 98 min |
| `matched-E0-glm` | same design, second model | glm-4.6 | 18 | 72 | $2.34 | 47 min |

Health: 215 of 216 beats in `main` produced an artifact; 209 parsed with a
working calculator; zero API failures across 7,800 calls.

---

## The result

**Equalising reach removes essentially the entire quality gap, and what is left
runs the other way on rework.**

Public minus private, requirement F1, paired within (scenario, seed):

| beat | `main` (unequal reach) | `matched-E0` (equal reach) |
|---|---|---|
| T1 cold build | **+0.26** | **+0.02** |
| T2 rework | +0.14 | **−0.09** |
| T3 warm build | +0.28 | +0.09 |
| T4 warm rework | +0.26 | **−0.17** |

At T2 under equal reach the public arm won **zero** of nine paired cells
(4 private wins, 5 ties).

Read plainly:

1. **The headline of the unequal run was a reach artifact.** "Breadth dominates"
   collapsed from +0.26 to +0.02 the moment both arms could see the same
   specialists. The difference was never about network form; it was about who
   was allowed in the roster. This is measured, not argued.
2. **A rework advantage for the private form appeared — and did not replicate.**
   On `deepseek-v4-flash` private led on both revision beats (T2 −0.09, T4 −0.17,
   public winning zero of nine paired cells at T2). Re-running the identical
   design on `glm-4.6` reversed it:

   | beat | flash (n=9/arm) | glm-4.6 (n=6/arm) |
   |---|---|---|
   | T1 | +0.02 | −0.12 |
   | T2 | **−0.09** | **+0.06** |
   | T3 | +0.09 | −0.03 |
   | T4 | **−0.17** | **+0.12** |

   Both rework beats flip sign between models. At six to nine episodes per arm
   this is noise, and the honest statement is that **the rework effect is not
   established**. It is worth chasing at 8–10 seeds; it is not worth claiming.
3. **Private pays more in tokens on the flash run** (T3: 81.5k vs public 49.8k;
   warm speedup −0.71 vs +0.03) but not on glm (private +0.11 vs public −0.21).
   That difference does not replicate either.

## What these runs cannot support

- **Delegation depth is untested.** Builders were asked whether anything was
  missing and answered `NONE` in all 324 beats, so `deriveGrant` was never
  called and `parent_not_delegable` never fired. One of the four knobs was
  never exercised.
- **The kernel allowed every contact** (0 denials in both runs). SharedOS is
  wired in and authorises each contact, and single-use exhaustion and delegation
  refusal were verified directly before the sweep — but no configuration in
  these runs produced a refusal. "Enforced by the kernel" is true as mechanism
  and vacuous as effect here.
- **Warm speedup measures almost nothing.** The warm instance replaces every
  fact value, so memory can save the search step and not the asking. Negative
  values everywhere are the design, not a finding. See `docs/DESIGN-FLAWS.md`.
- **n = 9 and n = 6 episodes per arm.** Every per-beat difference in the matched
  runs sits inside the noise those sample sizes allow, which the cross-model
  disagreement demonstrates rather than merely warns about.
- **Only one finding survives replication**, and it is the reach one — because it
  is a between-run comparison on a single model with a large effect, not a
  between-arm comparison inside one run.

## The one number worth keeping

> The cold-phase public advantage falls from **+0.26 to +0.02** when the two arms
> are given equal reach — roughly **92% of what looked like a public/private
> effect was an artifact of roster membership**.

Everything else measured tonight is inside the noise. That is the result: not
"breadth beats depth", but **most of the apparent difference between these two
network forms was never about the forms at all**, and once it is removed there is
not enough signal left at this sample size to say what remains.

## Next, in order

1. Raise `matched-E0` to 8–10 seeds per arm. Everything above rests on nine.
2. Rebuild the warm instance to share ~40% of its fact *values* with the cold
   instance, so memory can save asking rather than only searching.
3. Withhold one required fact from the builder's brief on purpose, so
   sub-delegation is forced and the depth knob is actually tested.
4. Add a single-use variant where a spent grant genuinely blocks re-contact, so
   the kernel refuses something and `rework_reachable` can be 0 for a real reason.
