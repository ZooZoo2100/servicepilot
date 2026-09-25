# Public publication verification — 25 September 2026

- Repository: https://github.com/ZooZoo2100/servicepilot (public).
- Application: https://servicepilot-one.vercel.app (simulation only).
- OpenAI/Anthropic live evaluation: intentionally not performed. No provider credentials configured, no real bookings or messages sent.

## Evidence

A fresh public clone completed `npm ci` and `npm run check`: 188 automated tests, types, lint, build and credential scan passed. GitHub Linux CI passed both local and public browser suites (13 + 5). README text, screenshots and Mermaid diagram were inspected on GitHub. All local Markdown targets resolved; no private environment file is tracked.

The first hosted release built but failed at runtime. Native Node ESM required an explicit JSON import attribute, masked by local bundling. The failure and original 0/5 hosted browser result are preserved in [findings](FINDINGS.md) and [initial output](browser-initial.txt). The corrected deployment passed [all five public browser checks](browser-after.txt). A new native Node ESM/SQLite startup check is included in CI. This is a deployment compatibility regression test, not a new model evaluation.

[HTTP and public asset scan](http-security.json) verifies root, Operations and Case Study return 200, JavaScript/CSS/favicon load, private file paths return 404, and CSP, HSTS, nosniff, framing, referrer and permission headers are present. No provider-key/private-key patterns or workstation paths were found in those responses. The production environment contains only an exact APP_ORIGIN and a sensitive server-only DEMO_SESSION_SECRET. No secrets were printed or committed.

Hosted browser checks exercise confirmation, cancellation, reload continuity, safety, clarification, handoff, long conversations, keyboard navigation, read-only evidence, invalid origin/state rejection and widths from 320 to 1440 pixels. The corrected deployment's first session request successfully initialized native SQLite; the adapter opens and closes a separate in-memory database per request. Build success alone is not used as runtime evidence.

## Reproduce

```bash
npm ci
npm run check
npm run test:runtime
PUBLIC_TEST_URL=https://servicepilot-one.vercel.app npm run test:public
```

Hosted checks make bounded simulation requests. They can encounter network outages or the per-instance rate limit; run deliberately, not in a polling loop.

## Operational limits

No real workshop/DMS integration or live language-model validation. Temporary state expires after 30 minutes, is replayable within that period, and provides no global scheduling capacity or durable transaction guarantee. Public Operations is curated fictional evidence, never visitors' conversations. No formal penetration test or uptime guarantee is claimed.

Deployment currently uses the authenticated Vercel CLI. Automatic GitHub project linking failed; enabling future push-triggered deployments requires connecting the repository through the user's Vercel/GitHub integration. The existing deployment does not depend on that integration. Hosting usage can still incur compute/bandwidth charges; no paid plan or add-on was purchased. Review account-level spend/abuse controls before broad promotion.
