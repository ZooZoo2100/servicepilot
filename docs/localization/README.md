# Danish workshop localization

Varde Motorværksted is a fictional workshop in Hedehusene, Denmark. The configured currency is DKK, locale da-DK, and timezone Europe/Copenhagen. Customer conversation remains English. Catalogue amounts (690–2,490) remain unchanged as fictional demonstration prices, not researched market quotes or currency conversions.

Services now carry an explicit currency field. Agent prices use Danish number formatting and the DKK code. Machine dates remain ISO; human appointment dates use Danish formatting. Existing catalogue rows are updated on initialization. Pre-localization public session tokens are intentionally invalidated so old conversation text cannot leak into the new demo; visitors can start a new session.

## Evidence integrity

Original evaluation JSON under `evals/runs/`, the adversarial before/after reports, earlier logs and historical screenshots outside `docs/screenshots/portfolio/` are unchanged. They describe the original Norwegian fixture and may still contain its location/currency. They are historical evidence, not current business configuration. Git history also necessarily preserves earlier source.

The current simulation report is a genuine Danish rerun, with locale metadata and a source hash that includes shared workshop configuration. Public Operations conversations are freshly generated. In Evaluation Lab, the original 89/100 run uses an explicitly labelled Danish *presentation copy*: names/currency labels/price formatting are translated and service currency is annotated, but its score and failure flags are unchanged. This is not claimed as a Danish rerun of the original implementation. The label links to the byte-preserved source. The transformation is inspectable in `scripts/localize-historical-display.ts`; source hashes remain in the curated artifact.

Portfolio screenshots are regenerated from the Danish build. Older diagnostic screenshots retain their original content to avoid rewriting evidence. Historical prose about the original date bug retains its original location, because that is what was tested then.

## First localization check

The first genuine Danish evaluation scored 98/100. SP-030 still required an ISO date substring in human-facing prose, and SP-088 still required the old street address. Both were obsolete localization assertions, not failed operational actions. Their original failing run is retained. Expected human-facing dates/location were corrected; structured booking dates remain ISO and are tested independently.

## Verified before deployment

- 197 automated tests passed (188 existing + 9 localization checks).
- Fresh Danish simulation: 100/100, after preserving the initial 98/100 localization-assertion failures.
- Adversarial API campaign rerun against the Danish backend: 29/29.
- Browser checks: 13 local + 6 public-build tests passed, including the new Danish identity/price check.
- Type checking, lint, production/public build, native Node ESM/SQLite check and credential scan passed.
- All 12 portfolio screenshots regenerated; no browser errors or case-study overflow.
- Eight pre-localization evaluation files are byte-identical to their committed originals (see `audit.json`).

The regex audit also lists an incidental substring in a dependency integrity hash; this is not a workshop reference. Deliberate old labels remain in the migration/display converter and negative regression assertions. No active source or curated public evidence contains the old business labels.
