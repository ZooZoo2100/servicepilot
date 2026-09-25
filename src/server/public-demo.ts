import express from "express";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { Store } from "./store.js";
import { Agent } from "./agent.js";
import { ToolLayer } from "./tools.js";
import { SimulationPlanner } from "./planner.js";
import { customerView } from "../shared/domain.js";
import {
  openState,
  sealState,
  SESSION_MS,
  type DemoState,
} from "./demo-state.js";
import { secretJsonReplacer } from "./secrets.js";
import evidence from "./portfolio-evidence.json" with { type: "json" };

const envelope = z
  .object({
    path: z.string().max(180),
    body: z.unknown().optional(),
    state: z.string().max(200000).optional(),
  })
  .strict();
const mutation = z
  .object({
    revision: z.number().int().nonnegative(),
    text: z.string().trim().min(1).max(2000).optional(),
    proposalId: z.string().uuid().optional(),
  })
  .strict();
export class DemoError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
/** Each request owns its database. No writable disk, instance affinity or shared visitor state. */
export async function dispatchDemo(input: unknown) {
  const parsed = envelope.safeParse(input);
  if (!parsed.success) throw new DemoError(400, "Invalid demo request.");
  const { path, body, state: token } = parsed.data;
  if (path === "/api/config" && body === undefined)
    return {
      data: {
        provider: "simulation",
        demoMode: true,
        publicDemo: true,
        workshop: "Varde Motorværksted",
      },
    };
  if (path === "/api/internal/overview" && body === undefined)
    return { data: evidence.overview };
  if (path === "/api/internal/evaluations" && body === undefined)
    return { data: evidence.runs };
  if (path === "/api/evaluation-summary" && body === undefined)
    return {
      data: evidence.runs.map(
        ({ id, at, provider, total, passed, failed, categories }) => ({
          id,
          at,
          provider,
          total,
          passed,
          failed,
          categories,
        }),
      ),
    };
  if (path.startsWith("/api/internal/"))
    throw new DemoError(403, "Public portfolio evidence is read-only.");
  let store: Store | undefined;
  try {
    let state: DemoState;
    if (path === "/api/session") {
      const selection = z
        .object({ customerId: z.enum(["c-nora", "c-erik", "c-new"]) })
        .strict()
        .safeParse(body);
      if (!selection.success)
        throw new DemoError(400, "Choose a fictional customer.");
      store = new Store(":memory:");
      // Public entry point always constructs the offline planner, regardless of environment.
      const agent = new Agent(
        store,
        new ToolLayer(store),
        new SimulationPlanner(),
      );
      const c = agent.create(selection.data.customerId);
      state = {
        version: 1,
        expiresAt: Date.now() + SESSION_MS,
        customerId: selection.data.customerId,
        conversationId: c.id,
        database: "",
      };
    } else {
      if (!token) throw new DemoError(401, "Start a new demo session.");
      try {
        state = openState(token);
      } catch {
        throw new DemoError(
          401,
          "This temporary demo session expired or is invalid. Start a new session.",
        );
      }
      store = new Store(Buffer.from(state.database, "base64"));
    }
    const c = store.conversation(state.conversationId, state.customerId);
    if (!c) throw new DemoError(404, "Conversation not found.");
    const base = `/api/conversations/${c.id}`;
    if (path !== "/api/session" && path !== base) {
      if (
        ![`${base}/message`, `${base}/confirm`, `${base}/withdraw`].includes(
          path,
        )
      )
        throw new DemoError(404, "Conversation not found.");
      const p = mutation.safeParse(body);
      if (!p.success)
        throw new DemoError(
          400,
          "Check your message (maximum 2,000 characters).",
        );
      if (p.data.revision !== c.revision)
        throw new DemoError(
          409,
          "The conversation changed. Refresh before continuing.",
        );
      if (c.messages.length >= 80)
        throw new DemoError(
          429,
          "This temporary demo has reached its limit. Start a new session.",
        );
      const agent = new Agent(
        store,
        new ToolLayer(store),
        new SimulationPlanner(),
      );
      if (path.endsWith("/message") && p.data.text)
        await agent.message(c, p.data.text);
      else if (path.endsWith("/confirm") && p.data.proposalId)
        agent.confirm(c, p.data.proposalId);
      else if (path.endsWith("/withdraw")) agent.withdraw(c);
      else throw new DemoError(400, "Invalid conversation action.");
    } else if (path === base && body !== undefined)
      throw new DemoError(400, "Invalid conversation action.");
    state.database = store.db.serialize().toString("base64");
    return { data: customerView(c), state: sealState(state) };
  } finally {
    store?.close();
  }
}
export const publicDemoApp = express();
publicDemoApp.disable("x-powered-by");
publicDemoApp.set("json replacer", secretJsonReplacer);
publicDemoApp.use(helmet());
publicDemoApp.use(express.json({ limit: "250kb" }));
publicDemoApp.post(
  "/api/demo",
  rateLimit({
    windowMs: 60000,
    limit: Number(process.env.CONVERSATION_RATE_LIMIT ?? 60),
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Too many requests. Please wait a minute." },
  }),
  async (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    // Deployment-specific exact origin, never inferred from an untrusted Host header.
    if (
      !process.env.APP_ORIGIN ||
      req.headers.origin !== process.env.APP_ORIGIN
    ) {
      res.status(403).json({ error: "Request origin is not allowed." });
      return;
    }
    try {
      res.json(await dispatchDemo(req.body));
    } catch (error) {
      res.status(error instanceof DemoError ? error.status : 503).json({
        error:
          error instanceof DemoError
            ? error.message
            : "The temporary demo could not complete this request. No action is confirmed. Please start a new session.",
      });
    }
  },
);
publicDemoApp.use("/api", (_req, res) => {
  res.status(404).json({ error: "Demo endpoint not found." });
});
publicDemoApp.use(
  (
    error: unknown,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction,
  ) => {
    res
      .status(
        error &&
          typeof error === "object" &&
          "type" in error &&
          error.type === "entity.too.large"
          ? 413
          : 400,
      )
      .json({ error: "Invalid demo request. Please start a new session." });
  },
);
