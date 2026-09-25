# Portfolio screenshots

Captured from the local production **public simulation** build, with fictional accounts only. Operations is curated read-only evidence; it does not contain public visitors' conversations. No API credentials or access forms appear in these images. Captured 24 September 2026; appointments and references are demonstration data.

| View | Screenshot |
|---|---|
| Service Desk / empty state | [01-service-desk.png](01-service-desk.png) |
| Realistic symptom and urgency conversation | [02-conversation.png](02-conversation.png) |
| Booking review / explicit confirmation | [03-confirmation.png](03-confirmation.png) |
| Confirmed simulated appointment | [03b-booking-confirmed.png](03b-booking-confirmed.png) |
| Read-only Operations / failed-write handoff | [04-operations.png](04-operations.png) |
| Evaluation Lab / current simulation | [05-evaluation-lab.png](05-evaluation-lab.png) |
| Original 89/100 run / failure investigation | [06-failure-investigation.png](06-failure-investigation.png) |
| Complete Case Study | [07-case-study.png](07-case-study.png) |
| Case Study introduction | [07b-case-study-introduction.png](07b-case-study-introduction.png) |
| Mobile service conversation | [08-mobile.png](08-mobile.png) |
| Mobile failure investigation | [08b-mobile-lab.png](08b-mobile-lab.png) |
| Mobile Case Study | [08c-mobile-case-study.png](08c-mobile-case-study.png) |

The expanded SP-089 failure in the Lab image is the genuine catalogue defect: a request for all services returned only routine service. Eight other failures in that initial run were overstrict handoff assertions. The case study explains this distinction and separately documents actual safety/context defects found in adversarial testing.

Regenerate intentionally with `node --import tsx scripts/capture-portfolio.ts` while the public production preview runs on port 3000 (or set `SCREENSHOT_ORIGIN`). The script makes only simulation requests. It checks browser errors and case-study overflow; screenshot inspection is still required. Historical test-state images elsewhere in this folder's parent remain separate from this clean presentation set.

Regenerated for the fictional Danish workshop in Hedehusene (DKK, da-DK, Europe/Copenhagen). Historical run views explicitly identify their localized presentation; original recorded evidence is preserved.
