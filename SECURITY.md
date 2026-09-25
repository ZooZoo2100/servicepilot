# Security

The public portfolio uses simulation only. It does not need provider keys or an admin token. Public Operations contains curated fictional evidence; visitor conversations are never published there. The earlier sections below describe the local engineering mode where indicated.

## Public demo boundary

- Each API request owns an isolated in-memory SQLite database. Continuity uses AES-256-GCM authenticated/encrypted state in tab sessionStorage, with a 30-minute expiry and bounded compressed/decompressed sizes. No writable disk or function affinity is required.
- Strict request schemas and the existing account-scoped tools still enforce proposal-bound confirmation. A forged state token fails before a database is opened. Another visitor's conversation ID cannot be used with a different session.
- The public route explicitly constructs SimulationPlanner and rejects failure-injection writes. No request selects a provider or reads server configuration. The only public Operations data is the reviewed bundled artifact.
- Exact Origin checks, Helmet/static security headers, bounded messages, session size/conversation limits and per-instance rate limits protect the entry point. Configure platform abuse controls before hosting; the process limiter is not a global quota.
- Session tokens are bearer state. They can be copied, replayed or forked before expiry and cannot be centrally revoked. Rotation of DEMO_SESSION_SECRET invalidates all old tokens. There is no claim of durable bookings or real customer authentication.
- Do not type real PII. Temporary state is processed in server memory; transport/hosting infrastructure has its own access and retention policies. The browser tab stores ciphertext and displays the customer's own messages.
- Native Linux/Vercel packaging and a hosted security smoke test remain unverified until an approved preview. No public deployment has occurred.

# Security model

## Scope and trust

All identities, registrations, service records and bookings are fictional. `DEMO_MODE=true` permits selecting any of the three demo accounts. **This is simulated identity, not customer authentication.** Account-scoping tests establish that an authenticated session cannot supply an arbitrary customer ID to a tool, not that the public demo selector proves a real person's identity. Never populate this deployment with real personal data.

With demo mode disabled, session creation is denied. A real identity provider, account verification and adviser roles must be implemented before production use. The project is production-minded, not a certified production system.

## Enforced controls

- HTTP-only SameSite=Strict session cookies; Secure in production; opaque random session IDs and 24-hour server-side expiry.
- Exact configured Origin required for mutating API requests. No permissive CORS. HTTPS required for production sessions.
- All conversation reads and updates are scoped to the session's customer ID; unknown and foreign conversation IDs return the same 404.
- Tool schemas reject additional properties, including `customerId` overrides. Vehicle and booking queries are account-scoped. Foreign and nonexistent booking references have the same error.
- Model output is untrusted and schema-validated again at the workflow boundary. No SQL, arbitrary function names or model-selected customer identity can be executed.
- Mutation tools reject the ordinary tool-call path. A server-only confirmation entrypoint must receive a current, unexpired, owned proposal. Booking versions and availability are rechecked inside the transaction.
- Replays, concurrent slot claims, stale versions, expired consent and failed tools have direct tests.
- Operations APIs require a server-configured bearer token on every call. Missing configuration fails closed. The browser keeps it in memory, not localStorage or URLs. Compare token bytes in constant time when equal length.
- Customer responses use an explicit projection: no internal trace, planner output, account ID or raw proposal slot ID.
- Helmet headers and production CSP; local fonts; React text rendering; no HTML from user/model output is injected into the DOM.
- Request body cap 16 KB; message cap 2,000 characters; strict request schemas; 60 API requests/IP/minute and 15 conversation mutations/IP/minute by default; conversation length cap 120 messages.
- Live calls: one per turn, 12-second timeout, zero retries, 700 output tokens and a persisted daily global call budget. Invalid budget values fail closed. Paid CLI evaluation requires a separate explicit opt-in.
- `.env`, database files, browser artifacts and dependencies are ignored. No real key or local admin token is committed.

## Prompt injection

Pattern detection blocks common attacks early, and the system prompt labels user data as untrusted. These measures are incomplete by nature. The meaningful protection is limited authority: the planner cannot fetch other accounts, change the service catalogue, reveal a secret it never receives, approve warranty, complete repairs, or call mutation tools with a confirmation grant. A malicious but schema-valid plan can still misinterpret a request or produce an unnecessary proposal; the user must review it. Live interpretation quality is not yet measured.

Safety keyword detection is also incomplete and can over-escalate negations. Live classification adds a second safety signal, but neither is a comprehensive automotive hazard detector. The product does not diagnose or certify driving safety.

## Known deployment limits

- One process and one persistent SQLite database. Rate limit counters and conversation locks are not distributed. Do not increase replicas without redesigning these controls.
- Behind a reverse proxy, configure Express `trust proxy` only for a verified deployment topology. The default remains disabled to avoid trusting forged forwarded IPs; shared proxy traffic may therefore share a limit.
- Demo accounts are shared identities. Visitors who deliberately select the same fictional account can see its bookings; do not claim personal confidentiality in public demo mode. Conversation IDs remain session-account scoped and unguessable.
- An operations token is coarse access control, not SSO/MFA or per-adviser authorization. Anyone with it can inspect fictional conversations and arm failures. Rotate it through server configuration; locking the UI does not revoke other sessions.
- Logs contain customer messages and vehicle context by design. Retention/deletion automation, encryption-at-rest policy and immutable audit storage are not implemented. Restrict filesystem/backups and keep real PII out.
- Tool fault injection is pre-operation. It does not emulate the uncertain outcome of a remote write timing out after commit. Real integrations need reconciliation and idempotency.
- A local process crash after booking commit but before conversation save needs operator reconciliation. Exactly-once recovery across crashes is not guaranteed.
- Provider SDK calls send limited conversation context and owned vehicle identifiers to the configured provider. Configure a suitable processing agreement and redaction policy before real data use.
- No formal penetration test, full WCAG audit or live-provider red-team campaign has been completed.

## Reporting and checks

Reproduce issues against an isolated demo database and include the trace and scenario ID, without credentials. Add a deterministic regression when possible. `npm run check` and `npm run test:e2e` cover the main boundaries. Dependency audit was clean during implementation; that is a dated observation, not a lasting security guarantee.

## Verification-phase findings

The audit found a foreign model-selected vehicle ID could reach a handoff, though no foreign record or booking change was exposed. It now fails ownership validation before context merge, and escalation independently checks its vehicle. Impossible dates/times and extra planner fields now fail schema validation. Failed handoffs no longer suppress safety advice. Explicit tool-call ceilings and run-wide paid-evaluation caps supplement the existing bounds. Diagnostic observations are conversation-scoped after a concurrency regression caught cross-request metadata mixing during development.

The audited built browser assets contain none of the configured local secrets. No real provider key was present, and no real-model evaluation or remote credential validation occurred. These findings and regression results do not remove the deployment limitations above.

## Credential setup hardening

See [the pre-credential audit and safe setup](docs/verification/OPENAI_SETUP.md). Server-only redaction protects conversation ingress, model diagnostics, persistence and JSON/report outputs. SDK logging is explicitly disabled. `npm run security:check` checks repository candidates, staged content, browser artifacts, ignored secret files and blank example credentials without printing values. Live evaluation reports remain ignored until reviewed. This does not protect screenshots of a key entered into a local editor/browser draft, forced Git additions, or every encoded secret. Live-provider evaluation was intentionally not performed and is not planned for the portfolio.
