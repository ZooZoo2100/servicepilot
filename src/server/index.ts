import "dotenv/config";
import { publicDemoApp } from "./public-demo.js";
import { redactSecrets, secretJsonReplacer } from "./secrets.js";
import express from "express";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";
import { randomBytes, timingSafeEqual } from "node:crypto";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import path from "node:path";
import { z } from "zod";
import { Store } from "./store.js";
import { ToolLayer } from "./tools.js";
import { Agent } from "./agent.js";
import { LivePlanner, SimulationPlanner } from "./planner.js";
import { customerView, type Conversation } from "../shared/domain.js";
const app = express();
app.set("json replacer", secretJsonReplacer);
const production = process.env.NODE_ENV === "production";
const demo = process.env.DEMO_MODE === "true";
const publicDemo = process.env.PUBLIC_DEMO === "true";
if (publicDemo) app.use(publicDemoApp);
const provider = publicDemo
  ? "simulation"
  : (process.env.AGENT_PROVIDER ?? "simulation");
if (!["simulation", "openai", "anthropic"].includes(provider))
  throw new Error("Unknown AGENT_PROVIDER");
if (
  provider !== "simulation" &&
  !process.env[provider === "openai" ? "OPENAI_API_KEY" : "ANTHROPIC_API_KEY"]
)
  throw new Error("Live provider requires a configured API key");
const store = new Store(
  publicDemo
    ? ":memory:"
    : (process.env.DATABASE_PATH ?? "var/servicepilot.sqlite"),
);
const toolLayer = new ToolLayer(store);
const agent = new Agent(
  store,
  toolLayer,
  provider === "simulation"
    ? new SimulationPlanner()
    : new LivePlanner(provider as "openai" | "anthropic"),
);
app.disable("x-powered-by");
app.use(helmet({ contentSecurityPolicy: production ? undefined : false }));
app.use(express.json({ limit: "16kb" }));
app.use(cookieParser());
app.use(
  "/api",
  rateLimit({
    windowMs: 60000,
    limit: 60,
    message: {
      error: "Too many requests. Please wait a minute and try again.",
    },
    standardHeaders: true,
    legacyHeaders: false,
  }),
);
app.use("/api", (req, res, next) => {
  res.setHeader("Cache-Control", "no-store");
  if (
    req.method !== "GET" &&
    req.headers.origin !== (process.env.APP_ORIGIN ?? "http://localhost:3000")
  ) {
    res.status(403).json({ error: "Request origin is not allowed." });
    return;
  }
  next();
});
const adminToken = process.env.ADMIN_TOKEN;
const same = (a: string, b: string) =>
  Buffer.byteLength(a) === Buffer.byteLength(b) &&
  timingSafeEqual(Buffer.from(a), Buffer.from(b));
app.use("/api/internal", (req, res, next) => {
  const token = req.headers.authorization?.replace(/^Bearer /, "") ?? "";
  if (!adminToken || !same(token, adminToken)) {
    res.status(401).json({ error: "An operations access token is required." });
    return;
  }
  next();
});
app.get("/api/config", (_req, res) =>
  res.json({ provider, demoMode: demo, workshop: "Varde Motorverksted" }),
);
app.post("/api/session", (req, res) => {
  if (!demo) {
    res.status(403).json({
      error:
        "Demo identities are disabled. Configure a production identity provider before use.",
    });
    return;
  }
  const p = z
    .object({ customerId: z.enum(["c-nora", "c-erik", "c-new"]) })
    .strict()
    .safeParse(req.body);
  if (!p.success) {
    res.status(400).json({ error: "Select a demo identity." });
    return;
  }
  const id = randomBytes(32).toString("hex");
  store.db.prepare("DELETE FROM sessions WHERE expires_at<?").run(Date.now());
  store.db
    .prepare("INSERT INTO sessions VALUES (?,?,?)")
    .run(id, p.data.customerId, Date.now() + 86400000);
  res.cookie("sp_session", id, {
    httpOnly: true,
    sameSite: "strict",
    secure: production,
    maxAge: 86400000,
  });
  const c = agent.create(p.data.customerId);
  res.json(customerView(c));
});
const busy = new Set<string>();
app.use("/api/conversations", (req, res, next) => {
  const row = store.db
    .prepare("SELECT customer_id FROM sessions WHERE id=? AND expires_at>?")
    .get(
      typeof req.cookies.sp_session === "string" ? req.cookies.sp_session : "",
      Date.now(),
    ) as { customer_id: string } | undefined;
  if (!row) {
    res
      .status(401)
      .json({ error: "Choose a demo customer to start a session." });
    return;
  }
  res.locals.customerId = row.customer_id;
  next();
});
app.get("/api/conversations/:id", (req, res) => {
  const c = store.conversation(req.params.id, res.locals.customerId);
  if (!c) {
    res.status(404).json({ error: "Conversation not found." });
    return;
  }
  res.json(customerView(c));
});
app.post(
  "/api/conversations/:id/:action",
  rateLimit({
    windowMs: 60000,
    limit: Number(process.env.CONVERSATION_RATE_LIMIT ?? 15),
    message: {
      error: "Too many requests. Please wait a minute and try again.",
    },
    standardHeaders: true,
    legacyHeaders: false,
  }),
  async (req, res) => {
    const key = String(req.params.id);
    if (busy.has(key)) {
      res
        .status(409)
        .json({ error: "A request is already in progress. Please wait." });
      return;
    }
    busy.add(key);
    try {
      const body = z
        .object({
          revision: z.number().int().nonnegative(),
          text: z.string().trim().min(1).max(2000).optional(),
          proposalId: z.string().uuid().optional(),
        })
        .strict()
        .safeParse(req.body);
      if (!body.success) {
        res
          .status(400)
          .json({ error: "Check your message (maximum 2,000 characters)." });
        return;
      }
      const c = store.conversation(key, res.locals.customerId);
      if (!c) {
        res.status(404).json({ error: "Conversation not found." });
        return;
      }
      if (c.revision !== body.data.revision) {
        res.status(409).json({
          error: "The conversation changed. Refresh before continuing.",
        });
        return;
      }
      if (c.messages.length >= 120) {
        res.status(429).json({
          error:
            "This demo conversation has reached its limit. Start a new session.",
        });
        return;
      }
      let result: Conversation;
      if (req.params.action === "message" && body.data.text)
        result = await agent.message(c, body.data.text);
      else if (req.params.action === "confirm" && body.data.proposalId)
        result = agent.confirm(c, body.data.proposalId);
      else if (req.params.action === "withdraw") result = agent.withdraw(c);
      else {
        res.status(400).json({ error: "Invalid conversation action." });
        return;
      }
      res.json(customerView(result));
    } finally {
      busy.delete(key);
    }
  },
);
app.get("/api/internal/overview", (_req, res) =>
  res.json({
    conversations: store.all("conversations"),
    handoffs: store.all("handoffs"),
    requests: store.all("requests"),
    bookings: store.bookings(),
    provider,
    database: "SQLite / simulated workshop",
    failureModes: [
      "timeout",
      "unavailable",
      "invalid_response",
      "conflict",
      "not_found",
      "stale",
    ],
  }),
);
app.post("/api/internal/failure", (req, res) => {
  const p = z
    .object({
      conversationId: z.string().uuid(),
      tool: z.enum([
        "get_available_slots",
        "create_booking",
        "modify_booking",
        "cancel_booking",
        "get_booking",
        "get_vehicle_record",
        "escalate_to_human",
      ]),
      failure: z.enum([
        "timeout",
        "unavailable",
        "invalid_response",
        "conflict",
        "not_found",
        "stale",
      ]),
    })
    .strict()
    .safeParse(req.body);
  if (!p.success) {
    res.status(400).json({ error: "Invalid failure configuration." });
    return;
  }
  toolLayer.failNext(p.data.conversationId, p.data.tool, p.data.failure);
  res.json({ armed: true });
});
function runs() {
  const dir = path.resolve("evals/runs");
  return existsSync(dir)
    ? readdirSync(dir)
        .filter((f) => f.endsWith(".json"))
        .sort()
        .reverse()
        .map((f) => JSON.parse(readFileSync(path.join(dir, f), "utf8")))
    : [];
}
app.get("/api/evaluation-summary", (_req, res) => {
  const all = runs();
  res.json(
    all.map((r) => ({
      id: r.id,
      at: r.at,
      provider: r.provider,
      total: r.total,
      passed: r.passed,
      failed: r.failed,
      categories: r.categories,
    })),
  );
});
app.get("/api/internal/evaluations", (_req, res) => res.json(runs()));
if (production) {
  app.use(express.static(path.resolve("dist/client")));
  app.get("/{*path}", (_req, res) =>
    res.sendFile(path.resolve("dist/client/index.html")),
  );
} else {
  const { createServer } = await import("vite");
  const vite = await createServer({
    server: {
      middlewareMode: true,
      ws: { port: Number(process.env.PORT ?? 3000) + 1 },
    },
    appType: "spa",
  });
  app.use(vite.middlewares);
}
app.use(
  (
    err: unknown,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction,
  ) => {
    console.error(
      "Request failed",
      err instanceof Error ? redactSecrets(err.name) : "unknown",
    );
    res
      .status(500)
      .json({ error: "The request could not be completed. Please try again." });
  },
);
app.listen(
  Number(process.env.PORT ?? 3000),
  process.env.HOST ?? "127.0.0.1",
  () =>
    console.log(
      redactSecrets(
        `ServicePilot running at ${process.env.APP_ORIGIN ?? "http://localhost:3000"} (${provider})`,
      ),
    ),
);
