# Final preparation findings

## Public hosting incompatibility

The original persistent SQLite file and process-local sessions cannot survive Vercel instance changes. The public adapter now uses the same Store/Agent/ToolLayer with a separate in-memory database per request. AES-256-GCM authenticated, compressed session state lives in the visitor's tab for at most 30 minutes. The public route always uses SimulationPlanner. Operations/Lab use separately curated read-only fictional artifacts, never visitor records. Local persistent mode remains available. Regression coverage is in `tests/public-demo.test.ts` and `tests/public-browser/portfolio.spec.ts`.

This is deliberately temporary demonstration state. Old tokens can be replayed/forked within their lifetime. It is not durable storage, global capacity, revocable customer authentication or exactly-once booking. Vercel/Linux native module packaging still requires a first authorized preview verification.

## Case study mobile overflow — genuine UI regression

The new evidence table inherited globally non-wrapping table cells. Its minimum width expanded the CSS grid beyond a 390px viewport. Both local and public browser suites caught it; `browser-local.txt`, `browser-public-initial.txt` and `case-overflow-before.png` preserve the failure before the fix. The evidence table now wraps text and uses bounded columns; the grid content has `min-width: 0`. The regression checks 1440, 768, 390 and 320px viewports.

## Browser runner artifact collision — harness defect

Running both browser configurations concurrently used the same Playwright artifact directory. One suite removed a trace while the other was closing its context; the booking-failure test's assertions passed but artifact cleanup failed with ENOENT. The original log is preserved in `browser-local.txt`. Each configuration now owns a separate directory under ignored `test-results/`. This is not counted as an agent behaviour failure.

## Public artifact hygiene

No Git commits existed during the audit. No API/private-key patterns or personal email addresses were found among Git-eligible files. Local-path references were found in genuine test logs and old setup notes. Public copies redact only workstation paths; byte-identical originals remain in ignored `docs/private-evidence/`. The redaction manifest records original/public hashes. Scenario inputs, expected/actual behaviour, scores and failure details are unchanged.

## Screenshot harness selector

The first attempt to select the catalogue category used an exact accessible-label match and timed out (`screenshot-capture-final.txt`). The control was present and working; the capture script now scopes the actual category select within the filter row. The failed capture log is retained; final gallery capture is rerun in full. This was a capture-harness defect, not a scenario failure.

## Single-result label

Final screenshot inspection found the Lab displayed “1 results” after category filtering. The label now selects the singular form for one result. `lab-single-result-before.png` preserves the inspected state; final portfolio captures use the corrected label.
