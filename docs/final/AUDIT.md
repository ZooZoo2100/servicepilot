# Final requirements audit

Scope: portfolio presentation and a simulation-only public hosting path. Original system requirements are mapped in `docs/verification/REQUIREMENTS.md`; its totals describe an earlier phase. Evidence below is local, not a hosted Vercel test.

| Requirement | Implementation / verification | Status / limitation |
|---|---|---|
| Customer Service Desk | Customer.tsx; local product.spec A/H/I; public booking/reload test | Verified simulation; no real LLM or real booking |
| Operations | Operations.tsx; public-demo.ts allowlist; public read-only tests | Public curated fictional records only; local records still token-protected |
| Evaluation Lab | EvaluationLab.tsx; original/current recorded reports; both browser suites | Original failures inspectable; deterministic scores clearly labelled |
| Case Study | CaseStudy.tsx; actual source evidence and verification regressions | Four requested failure/root-cause/fix stories, handoff, limitations and authorship |
| Navigation / keyboard | Main nav, skip link, ARIA tabs; local/public browser tests | Keyboard tab arrows/skip link verified; no formal screen-reader certification |
| Mobile / responsive | Public browser widths 1440/768/390/320; screenshots | Table overflow found and fixed; approved visual identity retained |
| Empty states | Local explicit UI fixtures for conversations, handoffs, Lab | Verified rendering; fixture use labelled |
| Loading / errors | Delayed request, 503 and non-JSON 429 local browser fixtures | Draft preserved; meaningful errors; no invented operational success |
| Long conversations/messages | 30-message UI fixture; real public multi-turn conversation; 2,000-char validation | Verified layout and caps; not arbitrary-length support |
| Confirmation / withdrawal | Existing transaction tests and browser A/H/I; public tests | No mutation from chat text alone; active owned proposal required |
| Cancellation | V05/V09; public end-to-end cancellation | Explicit confirmation retained |
| Human escalation | V06/V07; browser safety/human paths; curated public handoffs | Structured context and urgency; no real outgoing notification |
| Tool failures | Existing fault-injection scenarios and browser G | Failed write remains failed; public mutating fault controls disabled |
| Safety | Original/adversarial regressions, local/public browser tests | Advice survives failed escalation; pattern coverage remains limited |
| Customer isolation | API/Store/ToolLayer tests, public same-identity session isolation | Separate visitor databases; selected account scoped reads; no real identity proof |
| No paid evaluation | Explicit SimulationPlanner construction in public endpoint; network spy regression | Verified offline only; adapters unmeasured live |
| Evidence accuracy | Original JSON hashes, before/after reports, redaction manifest | No scores edited; public text logs remove workstation paths only |
| Public-repository hygiene | Credential scan of candidate/staged files and browser assets; history/tree audit | No exposed credential detected; ignored local secrets excluded; zero existing commits |
| Screenshots | Twelve portfolio PNGs; capture script and visual inspection | Fictional inputs; no credentials; full-page and mobile variants |
| Production build / routes | Public production build + public browser suite; Vercel entry/config inspection | Verified locally; cloud packaging, origin and routing smoke test still required |
| Serverless state | demo-state.ts + public-demo.ts; independent-request restore tests | No writable filesystem/instance affinity; temporary replayable state, not durability |
| Security headers | Helmet in API; static CSP/header configuration in vercel.json | API locally exercised; hosted static headers require approved preview |
| GitHub / Vercel publication | No push, repository creation, link or deploy command executed | Await explicit approval; no external deployment claimed |

See `FINDINGS.md` for the genuine final-phase issues and `REPORT.md` for verified totals and remaining release steps.
