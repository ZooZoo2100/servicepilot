# Deployment preparation — no publication or external deployment performed

## Two deliberately different modes

|                         | Local engineering mode                             | Public portfolio on Vercel                                     |
| ----------------------- | -------------------------------------------------- | -------------------------------------------------------------- |
| Entry point             | `src/server/index.ts`                              | `api/demo.ts`                                                  |
| Workshop storage        | One SQLite file / one process                      | Isolated SQLite in memory per request                          |
| Conversation continuity | Server database + session cookie                   | Authenticated encrypted state in tab sessionStorage            |
| Operations              | Token-protected local records and failure controls | Curated read-only fictional evidence                           |
| Planner                 | Simulation by default                              | Always SimulationPlanner, irrespective of provider environment |
| External integrations   | None                                               | None                                                           |

Vercel functions do not provide a persistent shared local filesystem. The public path therefore imports a server-side adapter that opens SQLite from an authenticated snapshot in memory; it does not open `var/`, use `/tmp`, or rely on a warm instance. The frontend carries the encrypted snapshot in a bounded POST body, avoiding cookie/header size limits. The same Store, Agent and ToolLayer enforce workflow rules in both modes.

State uses AES-256-GCM, random nonces and an application-specific authenticated context. It expires 30 minutes after session creation and is limited to 200,000 encoded characters / 1.5MB decompressed JSON. Each request closes its database. Visitor state never populates the public Operations artifact. No real records, notifications or bookings leave the demo.

**Important tradeoff:** a previous valid state token can be replayed or forked until expiry. There is no central revocation, global capacity across visitors or exactly-once booking. Closing/resetting the tab loses the temporary session. These semantics are suitable only for a clearly labelled fictional demonstration; real scheduling still needs durable transactional storage and real authentication.

## Vercel configuration, after approval

The repository supplies `vercel.json`: `npm run build:public`, static output `dist/client`, a Node function at `/api/demo`, explicit SPA rewrites for `/operations` and `/case-study`, a 10-second function bound, native SQLite file inclusion and security headers. Use Node.js **24.x** and an ordinary repository install on Vercel; never upload macOS `node_modules` as a Linux build artifact.

Set only:

- `APP_ORIGIN`: exact deployment origin, such as `https://servicepilot.example`; no trailing slash. Requests with a different Origin fail closed. A preview URL requires its own matching setting/build configuration.
- `DEMO_SESSION_SECRET`: a cryptographically random server-only value, at least 32 characters. Generate locally with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` and enter it in Vercel's environment settings. Do not put it in source or a `VITE_` variable. Rotation invalidates temporary sessions.

Do **not** add OpenAI/Anthropic keys or the local `ADMIN_TOKEN`. The public function needs neither. No paid-provider evaluation is planned or authorized. Public code explicitly instantiates SimulationPlanner; no visitor input selects a provider.

The UI transport is selected by `VITE_PUBLIC_DEMO=true` in the public build script; this is a non-secret build flag. `PUBLIC_DEMO=true` is only needed to preview the Vercel-style adapter inside the local Express server.

## Local public-preview check

Keep `.env` ignored. Configure `DEMO_SESSION_SECRET` locally and `APP_ORIGIN=http://localhost:3000`, stop any server already using port 3000, then:

```bash
npm run build:public
npm run preview:public
```

`npm run test:public` starts an isolated production server on port 3400 with a clearly fake test-only secret. It verifies booking/cancellation, reload continuity, read-only evidence, keyless public access, origin/tamper checks and responsive layout. `npm run test:e2e` separately checks the local engineering mode, including injected failed writes.

## Before first approved preview

1. Run check, simulation evaluation and both browser suites. Review `docs/final/REPORT.md` and security findings before pushing anything.
2. Approve GitHub publication/deployment explicitly. Neither has been performed here.
3. Set exact origin and a fresh session secret in the host environment. Select Node 24 and verify the Linux native `better-sqlite3` build/package in Vercel's build logs.
4. Test the actual hosted function across refreshes and cold starts, root/Operations/Case Study routes, CSP, origin rejection, and read-only Operations. Local Node verification is not a Vercel deployment test.
5. Configure available platform abuse/spend controls. The Express limiter is per warm instance, not a distributed quota; serverless hosting can incur costs even though model calls are impossible on the public path.
6. Confirm the public UI says simulation and temporary demonstration. Do not enter personal information.

No Vercel account/project is linked, no credentials were requested, and no remote preview was created. Native module packaging, cloud origin settings and cloud routing remain explicit unverified deployment steps.

## Persistent local/container alternative

The existing Dockerfile targets Node 24 and one persistent SQLite volume. This mode requires `ADMIN_TOKEN`, exact `APP_ORIGIN`, HTTPS and a single instance. It retains local conversations; it is not the public read-only portfolio mode. The Docker image has not been exercised here. Do not deploy the original file-backed server into a serverless filesystem.

## References consulted

[Node.js runtime](https://vercel.com/docs/functions/runtimes/node-js), [function files](https://vercel.com/kb/guide/how-can-i-use-files-in-serverless-functions), [vercel.json configuration](https://vercel.com/docs/project-configuration/vercel-json). These document supported primitives, not proof that this repository has been deployed.
