> Historical verification phase. Current public-demo status: live-provider evaluation was intentionally not performed. See [final report](../final/REPORT.md) for the latest counts and deployment boundaries.

# Verification report — 24 September 2026

The approved visual identity was preserved. This is a bounded verification report, **not a production-readiness claim**.

| Area | Result / evidence |
|---|---|
| AUTOMATED TESTS | 165 passing on Node 24. Typecheck, lint and production build pass. Baseline was 123 passing. See `evidence/final-check-v2.txt`. |
| BROWSER TESTS | 13 passing: original 10 end-to-end tests plus 3 labelled UI/transport fixture tests. Desktop/mobile, keyboard tabs, long unbroken text, empty/loading/error/proposal/handoff/operations/Lab/case-study views checked. Production browser inspection found no runtime or console errors. |
| SIMULATION EVALUATION | Original suite: 100/100 before and after this phase. New hostile application campaign: **18/29 before → 29/29 after**. This is evidence of coverage gaps in the original green suite. |
| REAL MODEL EVALUATION | **READY_FOR_LIVE_EVAL; not run.** No provider credential or explicit paid-run opt-in is configured. Mocked SDK transport tests are not a real-model evaluation. |
| SECURITY / GUARDRAIL FINDINGS | Existing confirmation, scoped reads and capacity gates resisted the exercised attacks. Found/fixed foreign-vehicle metadata in handoffs, weak planner schema validation, safety warnings lost on escalation failure, and misleading non-JSON limit errors. No unexpected successful booking mutation was observed in the adversarial campaign. Browser assets contain no configured local secret. |
| GENUINE FAILURES FOUND | Eleven failing exploratory cases, thirteen failing targeted assertions, and two diagnostic regressions introduced and caught during this phase. These overlap; they are not additive independent bug counts. Full findings F01–F12 distinguish original defects, integration gaps and newly introduced bugs. |
| ROOT-CAUSE FIXES | Explicit unresolved-field state; conservative entity/date conflict checks; correct negation and pending intent retention; safety obligation independent of handoff success; strict schemas and earlier ownership checks; independent escalation validation; eight-tool ceiling; robust error parsing; run-wide paid-call budget; provider structured-output/diagnostic isolation and accurate token attribution. |
| REGRESSION TESTS ADDED | 42 automated checks beyond the 123 baseline: 20 workflow/tool checks, 17 provider/configuration contracts, 3 API-client error checks, 2 provider-observation regressions. Also 3 browser fixture tests and a repeatable 29-case application campaign. |
| KNOWN LIMITATIONS | No measured live-model quality or real endpoint schema compatibility. Pattern-based simulation can miss unfamiliar phrasing and over-clarify. A schema-valid model can still propose a semantically wrong but owned/available action for review. Simulated identity and workshop only. No real adviser/DMS/warranty integration, remote-write reconciliation, crash-proof exactly-once commit, distributed locking/rate limits, full accessibility certification or verified container deployment. |
| REMAINING STEPS BEFORE PUBLIC DEPLOYMENT | Supply live configuration and run/inspect real-provider evaluation; run held-out language and safety cases; configure HTTPS/origin/admin secret and persistent single-instance hosting; verify backup/restore, retention, operational recovery and deployment. Keep all demo data fictional. Real-customer deployment additionally requires real authentication, roles, privacy controls and an idempotent/reconcilable DMS adapter. |

## Evidence map

- [Requirements matrix](REQUIREMENTS.md): requirement, location, verification, status and limitations.
- [Findings](FINDINGS.md): failures recorded before fixes, severity, root causes and changes.
- [Original-historical integrity check](evidence/historical-integrity.json): original 89/100 result and historical regression outputs unchanged.
- [Adversarial before](evidence/adversarial-isolated-before.json) / [after](evidence/adversarial-after.json): inputs, expected behaviour, actual responses, traces and provisional severity/root cause per case.
- [Targeted failures before fixes](evidence/regressions-before.txt): 13 failed of 17 checks before changes.
- [Provider concurrency failure](evidence/provider-concurrency-before.txt) and [budget attribution failure](evidence/provider-budget-observation-before.txt): introduced during this phase and caught before any real call.
- [Live configuration and run procedure](LIVE_EVALUATION.md): exact required variables and explicit initiation command.

The first campaign against port 3000 was interrupted by the default request limit; its partial artifact is retained. The complete before/after campaigns used isolated in-memory workshops on port 3200, the same production application, and a conversation-limit override solely to run the test set. The default rate-limit behaviour was separately checked. A browser action on the refreshed port-3000 application also verified that an ambiguous date now asks for clarification rather than offering the first slot.

The style bundle hash remained unchanged through the product fixes. New screenshots and visual fixtures are verification artifacts, not a new design direction. Some screenshots intentionally use synthetic long/empty UI data, clearly labelled in the test names; they are not represented as genuine customer activity.
