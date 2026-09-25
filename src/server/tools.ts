import { secretJsonReplacer } from "./secrets.js";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import type {
  Conversation,
  Failure,
  Handoff,
  Proposal,
  ToolResult,
  Trace,
} from "../shared/domain.js";
import { calendarDateSchema } from "../shared/domain.js";
import { Store, services, workshop } from "./store.js";
const id = z.string().min(1).max(120);
const schemas = {
  get_workshop_information: z.object({}).strict(),
  get_available_services: z.object({}).strict(),
  get_available_slots: z
    .object({
      serviceId: z.enum([
        "routine",
        "tyres",
        "brakes",
        "diagnostic",
        "battery",
        "ev",
      ]),
      date: calendarDateSchema.optional(),
    })
    .strict(),
  get_booking: z.object({ bookingId: id.optional() }).strict(),
  get_vehicle_record: z.object({ vehicleId: id.optional() }).strict(),
  create_booking: z.object({ proposalId: id }).strict(),
  modify_booking: z.object({ proposalId: id }).strict(),
  cancel_booking: z.object({ proposalId: id }).strict(),
  create_service_request: z
    .object({
      description: z.string().min(1).max(2000),
      vehicleId: id.optional(),
    })
    .strict(),
  escalate_to_human: z
    .object({
      reason: z.string().min(1).max(600),
      intent: z.string().max(600),
      urgency: z.enum(["normal", "urgent"]),
      vehicleId: id.optional(),
    })
    .strict(),
};
export type ToolName = keyof typeof schemas;
export const toolNames = Object.keys(schemas) as ToolName[];
export class ToolLayer {
  static readonly MAX_TOOLS_PER_TURN = 8;
  private counts = new WeakMap<Conversation, number>();
  beginTurn(c: Conversation) {
    this.counts.set(c, 0);
  }
  private failures = new Map<string, Failure>();
  constructor(public store: Store) {}
  failNext(conversationId: string, name: ToolName, failure: Failure) {
    this.failures.set(`${conversationId}:${name}`, failure);
  }
  private error(code: string, message: string): ToolResult {
    return { ok: false, error: { code, message } };
  }
  call(name: ToolName, args: unknown, c: Conversation): ToolResult {
    return this.execute(name, args, c, false);
  }
  confirm(c: Conversation, proposalId: string): ToolResult {
    const p = c.proposal;
    const name =
      p?.action === "cancel"
        ? "cancel_booking"
        : p?.action === "modify"
          ? "modify_booking"
          : "create_booking";
    return this.execute(name, { proposalId }, c, true);
  }
  private execute(
    name: ToolName,
    args: unknown,
    c: Conversation,
    authorized: boolean,
  ): ToolResult {
    const start = performance.now();
    const count = (this.counts.get(c) ?? 0) + 1;
    this.counts.set(c, count);
    let result: ToolResult;
    try {
      const parsed = schemas[name]?.safeParse(args);
      if (count > ToolLayer.MAX_TOOLS_PER_TURN)
        result = this.error(
          "TOOL_LIMIT",
          "The bounded tool budget has been reached. Please try again or contact an adviser.",
        );
      else if (!parsed?.success)
        result = this.error(
          "INVALID_INPUT",
          "The request could not be validated.",
        );
      else {
        const key = `${c.id}:${name}`,
          failure = this.failures.get(key);
        this.failures.delete(key);
        if (failure)
          result = this.error(
            failure.toUpperCase(),
            {
              timeout: "The scheduling system did not respond in time.",
              unavailable: "The workshop system is temporarily unavailable.",
              invalid_response: "The workshop returned an invalid response.",
              conflict: "That appointment is no longer available.",
              not_found: "The requested record was not found.",
              stale: "The availability information has expired.",
            }[failure],
          );
        else result = this.run(name, parsed.data, c, authorized);
      }
    } catch {
      result = this.error(
        "TOOL_ERROR",
        "The workshop system could not complete this request.",
      );
    }
    const trace: Trace = {
      id: randomUUID(),
      name,
      args,
      result,
      latencyMs: Math.round((performance.now() - start) * 100) / 100,
      at: this.store.now().toISOString(),
    };
    c.traces.push(trace);
    return result;
  }
  private run(
    name: ToolName,
    a: Record<string, unknown>,
    c: Conversation,
    authorized: boolean,
  ): ToolResult {
    const ok = (data: unknown): ToolResult => ({ ok: true, data });
    if (name === "get_workshop_information") return ok(workshop);
    if (name === "get_available_services") return ok(services);
    if (name === "get_available_slots")
      return ok(
        this.store.slots(a.serviceId as string, a.date as string | undefined),
      );
    if (name === "get_vehicle_record") {
      const data = a.vehicleId
        ? this.store.vehicle(a.vehicleId as string, c.customerId)
        : this.store.customerVehicles(c.customerId);
      return data
        ? ok(data)
        : this.error(
            "NOT_FOUND",
            "No matching vehicle was found in your account.",
          );
    }
    if (name === "get_booking") {
      const data = a.bookingId
        ? this.store.booking(a.bookingId as string, c.customerId)
        : this.store.bookings(c.customerId);
      return data
        ? ok(data)
        : this.error("NOT_FOUND", "Booking not found in your account.");
    }
    if (name === "create_service_request") {
      if (
        a.vehicleId &&
        !this.store.vehicle(a.vehicleId as string, c.customerId)
      )
        return this.error(
          "NOT_FOUND",
          "No matching vehicle was found in your account.",
        );
      const data = {
        id: `SR-${randomUUID().slice(0, 8)}`,
        customerId: c.customerId,
        description: a.description,
        vehicleId: a.vehicleId,
        status: "open",
        createdAt: this.store.now().toISOString(),
      };
      this.store.db
        .prepare("INSERT INTO requests VALUES (?,?,?)")
        .run(data.id, c.customerId, JSON.stringify(data, secretJsonReplacer));
      return ok(data);
    }
    if (name === "escalate_to_human") {
      if (a.vehicleId && !this.store.vehicle(String(a.vehicleId), c.customerId))
        return this.error(
          "NOT_FOUND",
          "No matching vehicle was found in your account.",
        );

      const previous = c.handoffId
        ? this.store.getHandoff(c.handoffId, c.customerId)
        : undefined;
      const h: Handoff = {
        id: previous?.id ?? `HF-${randomUUID().slice(0, 8)}`,
        customerId: c.customerId,
        vehicleId:
          c.context.vehicleId &&
          this.store.vehicle(c.context.vehicleId, c.customerId)
            ? c.context.vehicleId
            : undefined,
        summary: c.messages
          .filter((m) => m.role === "user")
          .slice(-6)
          .map((m) => m.text)
          .join("\n")
          .slice(0, 3000),
        intent: a.intent as string,
        facts: c.facts,
        actionsAttempted: c.traces.map((t) => t.name),
        reason: a.reason as string,
        urgency:
          previous?.urgency === "urgent"
            ? "urgent"
            : (a.urgency as "normal" | "urgent"),
        toolResults: c.traces.slice(-20),
        status: "waiting",
        createdAt: this.store.now().toISOString(),
      };
      this.store.handoff(h);
      c.handoffId = h.id;
      return ok({ id: h.id, status: h.status, urgency: h.urgency });
    }
    if (!authorized)
      return this.error(
        "CONFIRMATION_REQUIRED",
        "Confirm the current proposal before changing a booking.",
      );
    const p = c.proposal;
    if (!p || p.id !== a.proposalId || p.customerId !== c.customerId)
      return this.error(
        "INVALID_PROPOSAL",
        "This proposal is no longer current.",
      );
    if (Date.parse(p.expiresAt) <= this.store.now().getTime())
      return this.error(
        "EXPIRED",
        "This proposal has expired. Please request fresh availability.",
      );
    if (
      name !==
      `${p.action === "create" ? "create" : p.action === "modify" ? "modify" : "cancel"}_booking`
    )
      return this.error(
        "INVALID_PROPOSAL",
        "The action does not match the proposal.",
      );
    return this.store.db.transaction(() => this.commit(p, c))();
  }
  private commit(p: Proposal, c: Conversation): ToolResult {
    const error = (code: string, message: string) => this.error(code, message);
    if (!this.store.vehicle(p.vehicleId, c.customerId))
      return error(
        "NOT_FOUND",
        "No matching vehicle was found in your account.",
      );
    const existing = p.bookingId
      ? this.store.booking(p.bookingId, c.customerId)
      : undefined;
    if (
      p.action !== "create" &&
      (!existing ||
        existing.status !== "confirmed" ||
        existing.version !== p.version)
    )
      return error(
        "STALE",
        "This booking has changed. Please check its current details.",
      );
    if (p.action !== "cancel") {
      const slot = this.store.slot(p.slotId);
      if (
        !slot ||
        slot.serviceId !== p.serviceId ||
        !this.store.slots(p.serviceId, slot.date).some((s) => s.id === p.slotId)
      )
        return error(
          "CONFLICT",
          "That appointment is no longer available. Please choose another time.",
        );
    }
    let bookingId = p.bookingId;
    if (p.action === "create") {
      bookingId = `BK-${randomUUID().slice(0, 8).toUpperCase()}`;
      this.store.db
        .prepare("INSERT INTO bookings VALUES (?,?,?,?,?,?,?)")
        .run(
          bookingId,
          c.customerId,
          p.vehicleId,
          p.serviceId,
          p.slotId,
          "confirmed",
          1,
        );
    } else if (p.action === "modify")
      this.store.db
        .prepare(
          "UPDATE bookings SET slot_id=?,version=version+1 WHERE id=? AND customer_id=?",
        )
        .run(p.slotId, p.bookingId, c.customerId);
    else
      this.store.db
        .prepare(
          "UPDATE bookings SET status='cancelled',version=version+1 WHERE id=? AND customer_id=?",
        )
        .run(p.bookingId, c.customerId);
    return { ok: true, data: this.store.booking(bookingId!, c.customerId) };
  }
}
