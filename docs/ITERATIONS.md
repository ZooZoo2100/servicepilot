# Genuine iteration history

All events below happened during implementation on 24 September 2026. Source reports were captured before the first Git commit; original failure outputs have not been reconstructed or altered to tell a better story. Public text-log copies now redact the workstation path only; byte-identical originals remain in the ignored local archive. The original/public hashes and exact transformation are in [the redaction manifest](final/evidence-redactions.json). JSON scenario scores and traces remain unchanged.

## 1. First scenario run: 89/100

Original artifact: [first run](../evals/runs/2026-09-24T13-11-18-183Z.json). It contains all 100 inputs, expectations, outputs, tool traces and final states.

### Catalogue narrowed by incidental language — real product defect

**Input:** “What services do you offer?” (SP-089).

**Initial behaviour:** The planner inferred routine service from the word “services.” The response builder applied this optional filter to both catalogue and price intents and returned only routine service.

**Why wrong:** The customer asked for the whole catalogue; supported tyres and EV assessments disappeared from the answer.

**Root cause:** A service field was allowed to override a catalogue intent.

**Change:** Apply the service filter to price requests only. Catalogue intent always returns the verified full catalogue.

**Result:** SP-089 passes and returns the full service list, including EV and seasonal tyres.

### Immediate safety handoffs — eight incorrect test failures

SP-012, SP-048 through SP-053, and SP-075 correctly advised avoiding driving and created an urgent handoff. The harness required at least one _prior_ tool result inside every handoff. Immediate safety escalation has no prior tool call: its tool-results array is valid and empty.

**Change:** Verify that the array exists, not that it has an entry. Summary, reason and collected facts remain required. No safety behaviour was changed to satisfy these eight cases. It would be misleading to describe them as eight repaired safety failures.

### Record-not-found copy — two wording mismatches

SP-034 and SP-071 expected “not found,” while the tool returned “No matching booking was found in your account.” Both safely withheld nonexistent/foreign records.

**Change:** Standardize the message to “Booking not found in your account.” Authorization behaviour was already correct. This is not a privacy fix.

### Subsequent run: 100/100

The next timestamped artifact records all scenarios passing. The increase is a mixture of a product fix, an assertion correction and copy normalization. It does not establish an 11-point increase in language understanding or safety.

## 2. Later safety concern failed to upgrade an existing handoff — real product defect

**Sequence:** Ask about warranty, then report “My brakes barely work.”

**Initial behaviour:** The customer received urgent safety wording, but the existing handoff retained `urgency: normal` and its old summary.

**Risk:** The adviser queue could under-prioritize a safety-critical issue while the customer believed it had been escalated appropriately.

**Root cause:** Handoff deduplication returned an existing ID immediately, before merging new context.

**Evidence:** `iteration-initial.txt` records `expected 'normal' to be 'urgent'` before the fix.

**Change:** Update the owned existing record, refresh summary/facts/tool context, and raise urgency monotonically. Do not create a duplicate handoff or downgrade an urgent one.

**Result:** The same regression passes in `iteration-fixed.txt`; the automated suite retains it.

## 3. “Tomorrow” used the wrong day near midnight — real product defect

**Clock:** 2026-09-24 22:30 UTC, which is 00:30 on 25 September in Oslo.

**Input:** “Book routine service for Golf tomorrow.”

**Initial behaviour:** Requested 25 September, while the customer's tomorrow is 26 September.

**Risk:** A plausible but wrong appointment date could be offered for confirmation.

**Root cause:** Relative-date logic sliced a UTC timestamp rather than using the workshop's calendar day.

**Evidence:** `iteration-initial.txt` preserves the actual expected/received date assertion.

**Change:** A shared `workshopDate` function derives the Oslo date using `Intl.DateTimeFormat`, then performs calendar-day arithmetic. The planner's date context and seeded scheduling window use it.

**Result:** The exact midnight regression passes. Weekend unavailability is still enforced; the fix does not invent a Saturday slot.

## 4. Browser and review findings

The first browser suite passed nine of ten tests. The failure was a strict locator matching “COLLECTED FACTS” inside four handoff records, not a broken handoff view. Scoping the locator to the opened record fixed the test. Visual inspection found joined words where mobile CSS hid a line break; explicit spacing fixed it. The mobile composer was then moved ahead of optional starter actions so it is easier to reach.

A subsequent code review identified recursive handoff results embedded in later traces. The tool now returns only handoff ID/status/urgency while storing the full queue record separately; a repeated-handoff size regression protects this boundary. This was review-driven hardening, not a measured before/after failure-rate claim.

## Interpretation

A green aggregate was not a reason to stop examining the state machine. The later safety-urgency and timezone regressions found defects the original suite did not cover. Preserve that distinction when presenting the project: tests establish specific properties, and better tests expand what is known.
