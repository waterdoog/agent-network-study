# Three relational signals, three signals with nothing to act on

The paper reports that relational metadata does not move behavior. That claim is
narrower than it reads, and this note says how narrow.

## What was measured

Three manipulations, all with the network configuration held fixed.

| Signal | Form | Result |
|---|---|---|
| Prior trust | "the agents you reached gave you accurate values every time" | −0.010, spans 0 |
| Accountability | "this answer is logged and attributed to you by name" | −0.046, spans 0 |
| Relationship origin | "colleagues you have worked alongside for two years" vs "you found these agents on an open board" | +0.029, spans 0 |
| **Per-card reputation** | per card: "3 of its last 12 answers were later corrected" | −0.017, spans 0 |

A length-matched placebo carrying no relational content costs +0.005, so none of
this is the price of the tokens.

## Why each had nothing to change

**Trust and origin were uniform.** Both said the same thing about all 100 cards.
A claim that everyone is a two-year colleague carries no information a requester
could route on: it cannot change who to ask first, because it ranks nobody above
anybody. Deployed reputation is differential, and that is the whole of its value.

**Accountability was attached to agents with no discretion.** It went to
responders whose knowledge is a fixed list. Told that an answer is logged and
attributed, such a responder has nothing available to do differently — it could
already only read out what it holds.

**Per-card reputation had no alternative to route to.** This was built to fix
the first defect, and the marks are perfect: 100% accurate under `real` against
9% under a random placebo. The routing measurement shows what happened:

```
random   contacts to flagged cards 5.3%,  base rate 4.0%   ratio 1.32
real     contacts to flagged cards 23.8%, base rate 4.0%   ratio 5.96
```

Under `real` the requester goes *toward* flagged cards at six times the base
rate. The cards flagged unreliable are the ones holding planted falsehoods, and
in this task those are the same cards holding the true facts on their subject.
Avoiding a flag would have meant not asking the only source. The signal was
accurate, legible, and unactionable.

## What the null actually supports

Not "relational metadata does not work". Rather:

> A relational signal changes behavior only where it discriminates between
> options the agent can actually choose between. Three signals that did not —
> one uniform across all counterparts, one aimed at an agent with no discretion,
> one flagging the only available source — moved nothing.

The third is the sharpest, because the signal was perfect and still could not be
acted on.

## What would make it actionable

Two holders per fact, one reliable and one not, so a reputation mark selects
between sources rather than condemning the only one. That is a change to the
task, not to a configuration, and it is the experiment this line needs next.
