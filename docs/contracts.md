# Improvement plans

`src/plans` implements `mercature-plan-v1` over the independent synthetic
`spatial-v1` geometry contract. A plan saves the original concern or proactive
check, a human confirmation, the exact baseline and requirements, ordered
hypothetical operations, recomputable result bindings, and an operator decision.
It does not accept measured sites or certify accessibility.

## Records and bindings

A concern retains its original text, named language, exact supporting span and
source identity/revision. A proactive check instead names its expectation and
method; it cannot silently become a visitor complaint. Source provenance is
`synthetic` or `local`. Locally supplied evidence must use `local-only` permission.
Authored synthetic examples may explicitly use `exportable` permission. Changing
any origin field invalidates the existing confirmation.

Human confirmation records reviewer, timestamp, interpretation, origin hash,
scene hash, and the IDs, hashes and evidence snapshots of the selected inventory
features. Known supports, obstacles, unknown regions and named destinations can
be reviewed; destination evidence explicitly references its authored supporting
surface. IDs must be globally unambiguous. Empty, absent, duplicate and
unsubstantiated targets are rejected. Confirming a report's location does not
validate a reported condition or establish a measured clearance. No model is
required to use the manual confirmation workflow.

Every operation must concern a confirmed feature and pass the spatial scenario
validator. Only reviewed movable obstacles can be moved or removed; placement
must retain known support and avoid collisions. The original scene is immutable.
An empty scenario can save a reviewed issue with no geometric proposal. Signs,
ramps, implementation evidence and real measured geometry are not accepted by
this version.

Baseline and proposed results always use the same saved profile. Each load
validates inputs, reapplies ordered operations and runs both calculations.
Persisted hashes bind the scene, profile, scenario, solver and entire calculated
results. No cached passing result is trusted. Changed geometry, evidence,
requirements, solver bindings or result hashes fail with an explicit error.
Hashes establish consistency, not source authenticity or a reviewer's identity.

`planned`, `approved` and `rejected` are the only decision states. Approval never
marks physical work complete. Reporting implementation and independently verifying
outcomes require a future contract with new evidence and separate records.

## Local persistence and exports

`createPlanStore(storage?)` exposes `list`, `save`, `load` and `delete`. Each returns
`{ok: true, value}` or `{ok: false, error: {code, message}}`. Error codes distinguish
invalid/stale/corrupt records, size limits, missing records, unavailable storage
and quota failures. Browser storage is acquired only when an operation runs, so
denied storage access can be reported without preventing the manual workflow.

The collection uses one atomic localStorage write, has at most 20 plans and is
bounded to 4 MB of UTF-8 JSON. Each plan is bounded to 1 MB. A failed write leaves
the previous collection intact, and `save` reads its write back, so a write the
device drops is an error rather than a saved plan. Malformed collections are
preserved rather than silently reset. Each saved plan is opened on its own:
`list` returns the plans that open, newest first, then any plan that no longer
opens (for example after the place or the path check changed) with its problem.
Such a plan never blocks listing, opening or saving the others, is written back
unchanged, and can still be deleted. Replacing a saved plan cannot rewrite its
original source, baseline or creation timestamp. Changed original evidence requires a new plan ID. This
is browser-local persistence, not encrypted storage, remote backup or a
multi-user transactional database.

`serializePlan` / `parsePlan` are local persistence codecs. They are not sharing
APIs. `exportPlan` / `importPlan` reject local evidence and restricted synthetic
evidence; only explicitly exportable synthetic plans can cross that boundary.
Closed record schemas reject undeclared fields throughout the plan and geometry
so private sidecar metadata cannot leak through an export. There is no redaction
shortcut and no conversion of real evidence into synthetic provenance. The farm
canvas offers only a local backup: its download uses `serializePlan`, so the
file keeps the visitor's words and is the operator's own copy, and opening a
backup uses `parsePlan`. The interface offers no export for sharing.

## API

```ts
confirmTargets({ origin, scene, targetIds, reviewer, interpretation, now? })
createPlan({ id, title, origin, confirmation, project, decision?, notes?, now? })
evaluatePlan(plan) // freshly calculated { baseline, proposed }
reviseDecision(plan, decision, notes?, now?)
createPlanStore(storage?).list()
createPlanStore(storage?).save(plan)
createPlanStore(storage?).load(id)
createPlanStore(storage?).delete(id)
exportPlan(plan)
importPlan(json)
```

`tests/plans/plans.spec.ts` checks Korean text/span retention, proactive provenance,
manual target/evidence binding, no-proposal and approval/rejection states,
calculation consistency, invalid edits and stale results, synthetic-only exports,
closed schemas, malformed/oversized inputs, local save/reopen/deletion and storage
failure preservation. These are domain regression tests, not a Korean operator
study, measured-site validation or device performance evidence.
