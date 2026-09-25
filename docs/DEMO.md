# A five-minute technical demonstration

1. Open `/case-study`. Introduce Mirza Zohaaq Hussain and the operational problem: incomplete requests, limited capacity, ambiguous symptoms and safety-sensitive decisions. State that the public demo is deterministic simulation; no live provider evaluation was performed.
2. Open Service Desk, choose Nora, and type “Book a tyre change for my Golf.” Explain where vehicle, price and availability came from. Withdraw the proposal, request again and explicitly confirm.
3. Type “Cancel booking BK-DEMO-NORA”. Review the cancellation proposal; no destructive action occurs before confirmation.
4. Ask “My brakes barely work”. Show the driving caution and simulated urgent handoff. No real adviser is contacted.
5. Open Operations. In the public version, explain that these are curated read-only fictional records—not the current visitor's session. Expand the failed-booking handoff and its `create_booking / TIMEOUT` trace. Failure did not create a confirmed appointment.
6. Open Evaluation Lab. Compare 89/100 and 100/100; inspect SP-089 for the real catalogue defect. Explain that eight initial handoff failures were evaluation defects. Describe the separate adversarial campaign, 18/29 → 29/29, and the four failure stories in the case study.
7. Explain the public hosting tradeoff: each request gets an isolated in-memory workshop, with encrypted temporary browser-carried state. Sessions may reset or replay; no durable workshop capacity or production authentication is claimed.

For live fault injection and inspection of your current conversation, run local engineering mode and unlock Operations with your private local admin token. Public Operations deliberately cannot arm failures or inspect visitors' messages.

## Questions to be ready for

- **What prevents invented bookings?** Tools verify account ownership, a specific confirmed proposal, slot capacity and booking version. Customer responses use successful tool results, never a planner's assertion of success.
- **What does 100/100 mean?** One fixed simulation suite passed deterministic assertions. It is not a probability, independent benchmark, or OpenAI/Anthropic accuracy score.
- **What genuinely failed?** A failed handoff erased safety advice; first-match extraction chose the wrong vehicle; unresolved corrections retained stale dates; entity-only replies lost cancellation intent. Explain V02–V09 and the preserved before/after evidence.
- **What if an external booking API times out after committing?** The current mock fails before writes. A real adapter needs idempotency and reconciliation of unknown outcomes. Do not imply this is solved here.
- **Why no paid model evaluation?** This portfolio deliberately demonstrates workflow boundaries, deterministic evaluation and failure analysis. Provider adapters have mocked contract tests; live language quality remains unmeasured.
- **How was AI used?** Mirza defined product requirements, operational rules, behaviour, evaluation strategy and design direction. Coding agents accelerated implementation, tests and iteration. Architecture and evidence are documented for review.

The [screenshot gallery](screenshots/portfolio/README.md) and [final report](final/REPORT.md) document the verified presentation. This is not a full accessibility certification or production readiness claim.
