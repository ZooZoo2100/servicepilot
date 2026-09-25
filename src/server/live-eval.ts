import type { Planner } from "./planner.js";
export function liveEvalReadiness(env: NodeJS.ProcessEnv = process.env) {
  const provider = env.AGENT_PROVIDER;
  const missing: string[] = [];
  if (provider !== "openai" && provider !== "anthropic")
    missing.push("AGENT_PROVIDER=openai or anthropic");
  const prefix = provider === "anthropic" ? "ANTHROPIC" : "OPENAI";
  const key = env[`${prefix}_API_KEY`]?.trim();
  if (!key || /^(example|your[-_ ]|replace|test|placeholder)/i.test(key))
    missing.push(`${prefix}_API_KEY (a valid server-side credential)`);
  if (!env[`${prefix}_MODEL`]?.trim())
    missing.push(`${prefix}_MODEL (explicit account-accessible model ID)`);
  if (env.ALLOW_PAID_EVALS !== "true") missing.push("ALLOW_PAID_EVALS=true");
  const cap = Number(env.MAX_LIVE_EVAL_CALLS);
  if (!Number.isSafeInteger(cap) || cap < 1 || cap > 250)
    missing.push("MAX_LIVE_EVAL_CALLS (integer 1–250)");
  return {
    state: missing.length
      ? "READY_FOR_LIVE_EVAL"
      : "CONFIGURED_FOR_EXPLICIT_LIVE_RUN",
    provider: provider ?? "simulation",
    missing,
    maxCalls: Number.isSafeInteger(cap) ? cap : null,
    credentialsValidatedRemotely: false,
  };
}
/** Shared by every scenario in one CLI run, unlike scenario-local workshop databases. */
export class RunBudgetPlanner implements Planner {
  calls = 0;
  get label() {
    return this.inner.label;
  }
  get lastCall() {
    return this.inner.lastCall;
  }
  getLastCall(c: Parameters<Planner["plan"]>[1]) {
    return this.inner.getLastCall?.(c);
  }
  constructor(
    public inner: Planner,
    public readonly maxCalls: number,
  ) {
    if (!Number.isSafeInteger(maxCalls) || maxCalls < 1 || maxCalls > 250)
      throw new Error("Invalid live evaluation call budget");
  }
  async plan(...args: Parameters<Planner["plan"]>) {
    if (this.calls >= this.maxCalls)
      throw new Error("LIVE_EVAL_BUDGET_EXHAUSTED");
    this.calls++;
    return this.inner.plan(...args);
  }
}
