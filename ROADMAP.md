# Trading MCP feature roadmap

Updated 2026-10-26. Proposed release order, not delivery dates or evidence of customer demand. Targets below are pilot decision gates, not measured results.

## User and outcome

A research-oriented user who wants to explain a watchlist, rehearse decisions in paper mode and review what happened.

## Current baseline

MCP and REST already provide market data, indicators, screening, portfolio and order tools. The next feature work should join these capabilities into a reproducible paper-research workflow.

Planning evidence: [README](README.md) and [architecture](ARCHITECTURE.md) at `801815510d85`. This focused product pass does not claim a complete new code audit or live-provider validation.

## Prioritized releases

| Order | Feature                                        | User value and scope                                                                                                                 | Release acceptance                                                                                                                           |
| ----- | ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Now   | An explainable research snapshot               | Save a watchlist/screen with its inputs, data timestamps, provider identity, missing fields and reasons each symbol matched.         | The user can reopen the snapshot and explain each result without confusing current prices with the saved observation.                        |
| Next  | A paper decision journal                       | Attach a user-written thesis, planned action and expected review date to a paper order, then reconcile it with actual broker events. | Requested, accepted, filled, partially filled and canceled states remain distinct; an ambiguous response is never replayed as another order. |
| Next  | Review the process, not just a headline return | Compare the original rationale with later observations, including unfilled orders, costs and missing data.                           | A review separates simulated results from live outcomes and exposes its calculation inputs and limitations.                                  |
| Later | Opt-in watchlist changes                       | Notify users when a saved condition changes, with timestamps and a link to the underlying snapshot.                                  | Repeated observations do not spam the same alert; users can inspect, mute and remove rules.                                                  |

## Measure value before expanding

Measure time to produce and revisit a research snapshot, missing-data correction rate, journal completion and weekly repeat use. First gate: five paper scenarios retain a complete observation-to-outcome trail with no fabricated values or duplicate actions. Do not use profit as proof of tool correctness.

Collect the baseline before building the first slice. Use voluntary pilot feedback and minimal aggregate events; do not log private content or credentials to measure adoption. If the first workflow is not used again, revisit the problem before adding the later features. Revenue impact is unvalidated.

## Next shippable slice

Add persisted research snapshots and a comparison view using existing quote/screen outputs.

## Dependencies and deliberate limits

Before journal automation, verify integration of the truthful-cancellation and quote-identity fixes. Keep paper mode the product default. Autonomous live execution, promised returns and more signal types are outside the first milestones.

Engineering work belongs in the milestone only when it enables that acceptance criterion. Prefer existing native libraries and test runners. Update this roadmap when a user-visible increment ships, recording the outcome and remaining limits rather than checking off implementation activity alone.
