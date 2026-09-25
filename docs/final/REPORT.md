# Final portfolio and public-demo verification

Completed locally on 24 September 2026. **No GitHub publication, external deployment, paid-provider configuration or paid model call was performed.** OpenAI and Anthropic adapters exist; live-provider evaluation was intentionally not performed for this portfolio deployment.

## Final test results

| Check | Verified result | Evidence |
|---|---|---|
| Automated unit/integration tests | **188 passed** | `check-final.txt` (176 pre-hosting checks + 12 public adapter checks) |
| Local browser suite | **13 passed** | `browser-local-final.txt` |
| Public production-build browser suite | **5 passed** | `public-browser-release.txt` |
| Total browser checks | **18 passed** | Distinct local/public suites; three local cases use labelled UI/transport fixtures |
| Simulation evaluation | **100/100** | `evaluation-final.txt`; timestamped original JSON under `evals/runs/` |
| Historical simulation | **89/100 preserved** | Original JSON and original SHA-256 unchanged |
| Adversarial exploratory campaign | **18/29 → 29/29 preserved** | Earlier API campaign under `docs/verification/evidence/`; not rerun or relabelled as live-model testing in this phase |
| Types, lint, production/public build | Passed | `check-final.txt`, `release-verification.txt`, `public-browser-release.txt` |
| Production dependency audit | **0 known vulnerabilities reported** | `dependency-audit.json`; dated npm audit observation, not a lasting guarantee |
| Live model evaluation | **Intentionally not performed** | No claim of real-model interpretation quality or reliability |

Test counts overlap with evaluation scenarios; they are not 188 independent customer scenarios. Public screenshot generation also exercises real simulation flows, but is not counted as an additional browser suite.

## Public-repository security status

No exposed credential was found in Git-eligible files or built browser assets by exact-configured-value and known-pattern scans. Local environment credentials stay ignored; `.env.example` credential fields are blank. The audit covers personal-path and email patterns as well. There were **zero Git commits**, so no existing commit history could contain a secret. Git publication has not occurred.

Public text-log copies redact workstation repository/home paths only. Byte-identical originals remain in ignored `docs/private-evidence/`; `evidence-redactions.json` records original/public hashes and transformations. All original historical JSON evaluation artifacts remain unchanged. No score, scenario outcome or failure was rewritten. `.vercelignore` and `.dockerignore` also exclude local secret files and private archives.

See `public-repo-audit.json` and `security-check.txt`. Scanning is not a formal penetration test or proof against every encoded/unknown secret. Do not force-add ignored files; inspect the staged changes and rerun `npm run security:check` immediately before an approved publication.

## Deployment readiness

The public adapter removes writable-filesystem and warm-instance dependencies. Each request restores a separate SQLite database in memory using authenticated encrypted temporary state. It reuses the tested agent/tools and always selects SimulationPlanner. No external database, model key or real workshop connection is required. Operations and the Lab expose separately curated, read-only fictional evidence; visitor conversations never enter that artifact.

`vercel.json` prepares the public build, Node function, SPA routing, native module inclusion and static security headers. The same public entry point was exercised locally through a production build. **Actual Vercel packaging/routing is not verified**, because no remote deployment was authorized or performed.

## Case Study and README

The Case Study explains the problem, architecture, ten tool contracts, deterministic protections, evaluation denominators, four real failure/root-cause/fix/regression stories, handoff, security, authorship and limitations. It retains the restrained Varde design and identifies Mirza Zohaaq Hussain without unsupported seniority claims. Counts distinguish the 176/13 pre-hosting baseline from the current 188/18 totals.

README now provides a concise public introduction, architecture, capabilities, evidence, failure examples, local setup, verification, screenshots, security and hosting limits. Related architecture, evaluation, security, demonstration and deployment documents match the simulation-only decision. Old readiness notes are explicitly historical, not instructions to run a paid evaluation.

## Screenshots prepared

**12 clean portfolio screenshots** cover Service Desk, realistic conversation, proposal, confirmation, read-only Operations, current Evaluation Lab, original catalogue failure, desktop Case Study and mobile service/Lab/Case Study. See [the gallery](../screenshots/portfolio/README.md). The capture script reported no browser errors or case-study overflow. Desktop/mobile architecture and the mobile evidence table were separately visually inspected. Existing empty/loading/error/long-conversation images remain separate verification fixtures.

## Genuine final-phase findings and fixes

- The original disk-backed deployment could not provide continuity on Vercel. A bounded, isolated temporary-session adapter now avoids disk/instance affinity. Its intentionally non-durable semantics are documented and tested.
- New case-study content inherited a table no-wrap rule and overflowed mobile widths. Wrapping, bounded columns and grid minimum sizing fix it. Both failing logs and the before screenshot remain.
- Parallel browser suites collided over Playwright's temporary artifact directory. Separate output directories fix the harness; no booking behaviour failed in that collision.
- An exact-label screenshot selector timed out on a working category control. The capture harness now scopes the actual filter select; the failure log is retained.

See `FINDINGS.md` and [the requirement-by-requirement audit](AUDIT.md).

## Known limitations

- Fictional backend, identities and records; no DMS/CRM/dealership integration, real bookings, real outgoing messages or diagnostic/warranty authority.
- Deterministic planner has limited language coverage; no live-provider evaluation or live-model reliability claim.
- Public sessions expire after 30 minutes and can be copied, reset or replayed within that period. They are not durable, globally consistent scheduling or real customer authentication. Old-token replay intentionally affects only a private fictional snapshot.
- Rate limits are per process/function instance, not global abuse quotas. Hosting can incur ordinary compute/bandwidth costs despite having no model calls.
- No formal WCAG certification, penetration test, real-user study, Docker execution or hosted Vercel verification was completed.
- Real integrations still need durable transactions, identity, reconciliation for unknown write outcomes, retention policy and operational monitoring.

## Before GitHub

No known source blocker remains. Obtain explicit publication approval; review the staged file list, keep ignored environment/databases/private evidence out, and rerun the credential scan. Do not publish a screenshot of a secret or copy local environment values into repository files. No repository was created, pushed or made public here.

## Before Vercel

Obtain deployment approval. Set a new server-only `DEMO_SESSION_SECRET` and exact HTTPS `APP_ORIGIN`; select Node 24. No OpenAI/Anthropic key or admin token belongs in the public deployment. In the first approved preview, verify Linux `better-sqlite3` packaging, cold-start/session continuity, routes, security headers, origin enforcement and read-only evidence. Configure platform abuse/spend controls before sharing the public URL. Instructions are in [DEPLOYMENT.md](../DEPLOYMENT.md).

Tests establish the documented demo boundaries. They do not make this a production-ready workshop system.
