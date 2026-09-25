# Evaluation

## What is measured

The 100 scenarios in `evals/scenarios.ts` execute conversation turns, optional confirmation/withdrawal, and optional one-shot tool failures against an isolated in-memory SQLite database. Each run fixes the clock to **2026-09-24 10:00 UTC**, so availability is reproducible.

Assertions examine required/forbidden response content, called/forbidden tools, proposal presence, handoff presence, booking count, cancellation count, and proposed vehicle/service/date. Every scenario also checks foreign-account state preservation and absence of booking creation without confirmation. When expected, handoffs must contain a summary, reason, facts and a tool-results array; the array may legitimately be empty for an immediate safety handoff.

This is deterministic assertion-based evaluation. **No LLM judge is used.** Some response checks are substring tests; they can catch a missing safety instruction or fabricated success wording, but are not comprehensive semantic scoring.

## Current evidence

| Evidence                                    | Actual outcome | Interpretation                                                                                                                                                                                                                               |
| ------------------------------------------- | -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| First recorded simulation run               | 89 / 100       | 1 catalogue defect, 8 overstrict handoff assertion failures, 2 response-wording mismatches                                                                                                                                                   |
| Subsequent simulation run                   | 100 / 100      | Current scenarios satisfy their deterministic expectations; not a live model quality score                                                                                                                                                   |
| Additional iteration regressions, initially | 1 / 3          | Two real bugs: urgency upgrade and Oslo-relative date                                                                                                                                                                                        |
| Same three regressions after fixes          | 3 / 3          | Corrected escalation updates and calendar arithmetic                                                                                                                                                                                         |
| Full automated suite                        | 197 checks     | Includes 100 scenarios, 18 original authority-boundary checks, 5 original iteration checks, 42 verification/provider/client checks, 11 credential-safety checks, 12 public-hosting checks and 9 Danish localization checks; **not 197 independent conversation scenarios** |
| Browser suites                              | 19 tests       | 13 local tests plus 6 public-production checks; A–J demos, API boundaries, Lab, mobile, errors and temporary-session isolation                                                                                                               |
| Paid/live-model evaluation                  | Not run        | No claim about OpenAI/Anthropic interpretation accuracy                                                                                                                                                                                      |

The first run and subsequent timestamped reports remain in `evals/runs/`; the Evaluation Lab loads the actual artifacts. Read [ITERATIONS.md](docs/ITERATIONS.md) before citing the score change: most first-run failures were test/copy mismatches, not unsafe product decisions. The two later product regressions were discovered by targeted review and are not retroactively counted in that 100-scenario score.

## Coverage

The suite covers normal booking, incomplete/ambiguous language, multi-intent priority, unavailable dates/times, explicit consent, modification, cancellation, existing/unknown accounts, ambiguous vehicles, EV assessment, catalogue pricing, warranty uncertainty, dangerous symptoms, unsupported work, human escalation, hostile wording, privacy, adversarial instructions, context retention, corrections and uncommon valid phrasing.

Failure scenarios inject timeout, unavailable system, invalid response, conflict, missing record and stale availability into booking writes; four also exercise availability reads. Simulated failures are returned **before any business write**, and this is labelled in documentation and internal controls.

Additional tests attack the tool boundary directly: no confirmation grant, stale/expired/replayed proposals, competing appointments, technician conflicts across services, changed booking versions, customer ID override, unknown tools, foreign references, malicious planner vehicle selection, provider failure, private response projection, preserved bookings after failed writes, and structured error evidence.

## Run intentionally

```bash
npm test                     # scenario + boundary regressions, no report written
npm run eval                 # offline run, writes full JSON evidence
npm run test:e2e             # separate in-memory workshop server, browser flows
```

## Live-provider status

OpenAI and Anthropic adapters were implemented, but **live-provider evaluation was intentionally not performed for this portfolio deployment**. Do not configure credentials or run paid evaluations for this project. The public entry point always constructs SimulationPlanner, even if a provider environment variable is present. Adapter transport tests use intercepted HTTP and dummy credentials; they establish request/schema/error contracts, not provider quality.

The earlier readiness checks and bounded CLI implementation remain as historical engineering evidence. They are not an outstanding portfolio requirement. No simulation score should ever be described as OpenAI/GPT/Anthropic performance.

## Evidence format and history

A report records timestamp, provider, fixed clock, total/passed/failed counts, categories and each scenario's expected behaviour, inputs, actual response, assertion failures, tool arguments/results/latency and final database state. Later reports also include source and scenario fingerprints. The initial artifacts were captured before the first repository commit and say `uncommitted`; no historical commit is invented. IDs, timings and generated references vary, while asserted behaviour remains deterministic.

Do not overwrite failed reports to make the Lab look clean. Add a new run after the fix and describe whether you changed application behaviour, test expectations or both. Do not compare percentages across different scenario sets without saying so.

## Limits and next evaluation work

The fixture planner and scenario definitions were developed together. That makes regression evidence useful but not an independent validation set. A possible future improvement outside this portfolio scope is a held-out corpus of real-style paraphrases, negations, multiple vehicles and dates, with additional deterministic assertions and independent review. Add semantic policy checks and expert review alongside deterministic checks. Expand provider-failure tests to malformed/partial responses and enforce unknown-outcome reconciliation for a real DMS. Measure escalation precision, unnecessary clarifications and consent comprehension instead of optimizing only aggregate pass rate.

## Verification-phase audit

See [requirements matrix](docs/verification/REQUIREMENTS.md), [findings](docs/verification/FINDINGS.md) and [live readiness](docs/verification/LIVE_EVALUATION.md). The new adversarial campaign initially passed 18/29 and now passes 29/29. The original 100-scenario suite was green before those bugs were discovered. Do not present its unchanged 100% as proof the original implementation was reliable.

The final public-hosting verification and exact browser split are recorded in [the final report](docs/final/REPORT.md). The original 176-test / 13-browser baseline remains distinguishable from later hosting regressions. No live-model evaluation occurred or is planned for this deployment.

Current workshop configuration is Danish. Earlier location references in iteration history describe the original fixture; see [localization evidence](docs/localization/README.md) for preservation rules and the genuine Danish rerun.
