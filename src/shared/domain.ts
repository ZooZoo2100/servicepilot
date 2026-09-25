import { z } from "zod";
export const calendarDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((v) => {
    const d = new Date(v + "T12:00:00Z");
    return Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === v;
  }, "Invalid calendar date");
export const intentSchema = z
  .object({
    intent: z.enum([
      "book",
      "modify",
      "cancel",
      "lookup",
      "hours",
      "services",
      "price",
      "vehicle",
      "symptom",
      "warranty",
      "human",
      "complaint",
      "unsupported",
      "unknown",
    ]),
    serviceId: z
      .enum(["routine", "tyres", "brakes", "diagnostic", "battery", "ev"])
      .nullable(),
    vehicleId: z.string().max(30).nullable(),
    date: calendarDateSchema.nullable(),
    time: z
      .string()
      .regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/)
      .nullable(),
    bookingId: z.string().max(50).nullable(),
    safetyCritical: z.boolean(),
    correction: z.boolean(),
    withdraw: z.boolean(),
    summary: z.string().max(600),
    clarification: z
      .enum(["date", "vehicle", "service", "intent"])
      .nullable()
      .optional(),
  })
  .strict();
export type Intent = z.infer<typeof intentSchema>;
export type Service = {
  id: string;
  name: string;
  minutes: number;
  price: number;
  currency: "DKK";
  description: string;
  skill: string;
};
export type Vehicle = {
  id: string;
  customerId: string;
  make: string;
  model: string;
  year: number;
  registration: string;
  powertrain: string;
  history: string[];
};
export type Booking = {
  id: string;
  customerId: string;
  vehicleId: string;
  serviceId: string;
  slotId: string;
  status: "confirmed" | "cancelled";
  version: number;
};
export type Slot = {
  id: string;
  serviceId: string;
  date: string;
  time: string;
  technicianId: string;
};
export type Failure =
  | "timeout"
  | "unavailable"
  | "invalid_response"
  | "conflict"
  | "not_found"
  | "stale";
export type ToolResult =
  | { ok: true; data: unknown }
  | { ok: false; error: { code: string; message: string } };
export type Trace = {
  id: string;
  name: string;
  args: unknown;
  result: ToolResult;
  latencyMs: number;
  at: string;
};
export type Fact = {
  label: string;
  value: string;
  source: "known" | "inferred" | "unknown" | "tool-verified";
};
export type Proposal = {
  id: string;
  action: "create" | "modify" | "cancel";
  customerId: string;
  vehicleId: string;
  serviceId: string;
  slotId: string;
  bookingId?: string;
  version?: number;
  expiresAt: string;
  summary: string;
};
export type Message = {
  id: string;
  role: "user" | "assistant";
  text: string;
  at: string;
};
export type Handoff = {
  id: string;
  customerId: string;
  vehicleId?: string;
  summary: string;
  intent: string;
  facts: Fact[];
  actionsAttempted: string[];
  reason: string;
  urgency: "normal" | "urgent";
  toolResults: Trace[];
  status: "waiting";
  createdAt: string;
};
export type ProviderCall = {
  provider: string;
  model: string;
  requestId?: string;
  inputTokens?: number;
  outputTokens?: number;
  rawOutput?: string;
  errorCode?: string;
  httpStatus?: number;
};
export type Conversation = {
  id: string;
  customerId: string;
  messages: Message[];
  traces: Trace[];
  facts: Fact[];
  context: {
    serviceId?: string;
    vehicleId?: string;
    date?: string;
    time?: string;
    bookingId?: string;
    intent?: Intent["intent"];
    clarification?: "date" | "vehicle" | "service" | "intent";
    clarificationAttempts?: number;
  };
  proposal?: Proposal;
  handoffId?: string;
  revision: number;
  provider: string;
  planning?: {
    at: string;
    latencyMs: number;
    result?: Intent;
    error?: string;
    providerCall?: ProviderCall;
  }[];
  updatedAt: string;
};
export type CustomerView = {
  id: string;
  messages: Message[];
  proposal?: Pick<Proposal, "id" | "action" | "summary" | "expiresAt">;
  handoffId?: string;
  revision: number;
  provider: string;
};
export function customerView(c: Conversation): CustomerView {
  return {
    id: c.id,
    messages: c.messages,
    proposal: c.proposal
      ? {
          id: c.proposal.id,
          action: c.proposal.action,
          summary: c.proposal.summary,
          expiresAt: c.proposal.expiresAt,
        }
      : undefined,
    handoffId: c.handoffId,
    revision: c.revision,
    provider: c.provider,
  };
}
