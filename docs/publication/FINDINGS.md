# Publication findings — 25 September 2026

## First Vercel invocation failed

Deployment `dpl_2GyMMUKUdbdRG8a5GsfSWdbqNnS6` built successfully, but the first public `/api/demo` request returned HTTP 500 / `FUNCTION_INVOCATION_FAILED`. This was observed before any fix. A successful build did not establish runtime compatibility. Root-cause investigation follows.

The initial hosted browser run failed 5/5 checks. Runtime logs identified `ERR_IMPORT_ATTRIBUTE_MISSING`: native Node ESM requires `with { type: "json" }` on the evidence JSON import. Local esbuild bundling and Vitest had hidden this incompatibility. Added the explicit import attribute and a native, unbundled Node runtime smoke check to catch the class of failure before deployment. No database infrastructure change was needed.

After the fix, deployment `dpl_BFNsuPmHmmeGKhsSVABQqtkrV4cA` returned HTTP 200 for its first session creation and all five public browser checks passed (23.4 seconds). The 188 automated tests, native Node smoke check and five local public browser checks also passed. See `browser-after.txt` and `local-regression.txt`.
