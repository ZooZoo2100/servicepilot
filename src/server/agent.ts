import { requestConstraints } from "./constraints.js";
import { redactSecrets } from "./secrets.js";
import { randomUUID } from "node:crypto";
import { intentSchema } from "../shared/domain.js";
import type {
  Booking,
  Conversation,
  Intent,
  Proposal,
  Service,
  Slot,
  ToolResult,
  Vehicle,
} from "../shared/domain.js";
import { Store } from "./store.js";
import { ToolLayer, type ToolName } from "./tools.js";
import { injectionSignal, type Planner, safetySignal } from "./planner.js";
export class Agent {
  constructor(
    public store: Store,
    public tools: ToolLayer,
    public planner: Planner,
  ) {}
  create(customerId: string): Conversation {
    const c: Conversation = {
      id: randomUUID(),
      customerId,
      messages: [],
      traces: [],
      facts: [],
      context: {},
      revision: 0,
      provider: this.planner.label,
      updatedAt: this.store.now().toISOString(),
    };
    this.say(
      c,
      "Welcome to Varde. Tell me what your car needs, and we’ll find the next step.",
    );
    this.store.save(c);
    return c;
  }
  private say(c: Conversation, text: string) {
    c.messages.push({
      id: randomUUID(),
      role: "assistant",
      text,
      at: this.store.now().toISOString(),
    });
  }
  private finish(c: Conversation, text: string) {
    this.say(c, text);
    c.revision++;
    c.updatedAt = this.store.now().toISOString();
    this.store.save(c);
    return c;
  }
  private call<T>(c: Conversation, name: ToolName, args: unknown): T {
    const r = this.tools.call(name, args, c);
    if (!r.ok) throw new ToolFailure(r);
    return r.data as T;
  }
  private handoff(
    c: Conversation,
    reason: string,
    intent: string,
    urgent = false,
  ) {
    this.call(c, "escalate_to_human", {
      reason: reason.slice(0, 600),
      intent: intent.slice(0, 600),
      urgency: urgent ? "urgent" : "normal",
      ...(c.context.vehicleId ? { vehicleId: c.context.vehicleId } : {}),
    });
    return `I’ve created a ${urgent ? "priority " : ""}handoff for a workshop adviser (${c.handoffId}). This is a simulated queue; no real adviser is contacted. No response time is promised.`;
  }
  async message(c: Conversation, text: string) {
    text = redactSecrets(text);
    this.tools.beginTurn(c);
    c.messages.push({
      id: randomUUID(),
      role: "user",
      text,
      at: this.store.now().toISOString(),
    });
    // Every new message invalidates the prior consent target, including corrections and ambiguous replies.
    c.proposal = undefined;
    c.facts.push({
      label: "Customer statement",
      value: text.slice(0, 600),
      source: "known",
    });
    c.facts = c.facts.slice(-30);
    let safetyRequired = safetySignal(text);
    try {
      if (safetyRequired)
        return this.finish(
          c,
          `Braking, steering, smoke or overheating concerns can be safety-critical. Avoid driving until the vehicle has been assessed; arrange roadside assistance if needed. I can’t diagnose the cause remotely. ${this.handoff(c, "Potentially safety-critical vehicle condition", text, true)}`,
        );
      if (injectionSignal(text))
        return this.finish(
          c,
          "I can help with your own vehicle and workshop appointments. I can’t reveal internal instructions, access other customers’ records, override availability or invent approvals.",
        );
      const ownVehicles = this.call<Vehicle[]>(c, "get_vehicle_record", {});
      const planningStart = performance.now();
      const previousObservation = this.planner.getLastCall?.(c);
      let p: Intent;
      try {
        if (
          ["openai", "anthropic"].includes(this.planner.label) &&
          !this.store.consumeModelBudget(
            Number(process.env.MAX_DAILY_MODEL_CALLS ?? 100),
          )
        )
          throw new Error("Daily model budget reached");
        p = intentSchema.parse(
          await this.planner.plan(text, c, ownVehicles, this.store.now()),
        );
        (c.planning ??= []).push({
          at: this.store.now().toISOString(),
          latencyMs: Math.round(performance.now() - planningStart),
          result: p,
          providerCall: this.planner.getLastCall?.(c),
        });
      } catch {
        (c.planning ??= []).push({
          at: this.store.now().toISOString(),
          latencyMs: Math.round(performance.now() - planningStart),
          error: "Planning failed or budget exhausted",
          providerCall:
            this.planner.getLastCall?.(c) !== previousObservation
              ? this.planner.getLastCall?.(c)
              : undefined,
        });
        throw new Error("Planning unavailable");
      }
      if (p.safetyCritical) {
        safetyRequired = true;
        return this.finish(
          c,
          `This may be safety-critical. Avoid driving until assessed and arrange roadside assistance if needed. ${this.handoff(c, "Safety-critical concern identified during planning", text, true)}`,
        );
      }
      const constraints = requestConstraints(text, ownVehicles);
      if (p.withdraw || constraints.withdraw) {
        c.context = {};
        return this.finish(
          c,
          "Understood. I’ve withdrawn the proposal. No booking was created or changed.",
        );
      }
      if (p.vehicleId && !ownVehicles.some((v) => v.id === p.vehicleId)) {
        c.context.vehicleId = undefined;
        throw new Error("Planner selected an unowned vehicle");
      }
      const uncertainty = constraints.ambiguousDate
        ? "date"
        : constraints.matches.length > 1 || constraints.unknownVehicle
          ? "vehicle"
          : p.clarification;
      for (const k of [
        "serviceId",
        "vehicleId",
        "date",
        "time",
        "bookingId",
      ] as const)
        if (p[k]) c.context[k] = p[k];
      if (p.correction && !p.time) c.context.time = undefined;
      if (
        /^\s*BK-[A-Z0-9-]+[.! ]*$/i.test(text) &&
        ["cancel", "modify"].includes(c.context.intent ?? "")
      )
        p.intent = c.context.intent!;
      c.context.intent = p.intent;
      if (
        uncertainty &&
        ["book", "modify", "cancel", "symptom", "unknown"].includes(p.intent)
      ) {
        if (uncertainty === "date") {
          c.context.date = undefined;
          c.context.time = undefined;
        }
        if (uncertainty === "vehicle") c.context.vehicleId = undefined;
        const attempts =
          c.context.clarification === uncertainty
            ? (c.context.clarificationAttempts ?? 0) + 1
            : 1;
        c.context.clarification = uncertainty;
        c.context.clarificationAttempts = attempts;
        if (attempts >= 3)
          return this.finish(
            c,
            this.handoff(
              c,
              "Uncertainty remains after repeated clarification",
              text,
            ),
          );
        return this.finish(
          c,
          uncertainty === "date"
            ? "Which exact date should I check? Please use YYYY-MM-DD; I won’t choose between ambiguous dates."
            : uncertainty === "vehicle"
              ? `Which registered vehicle should we handle first? ${ownVehicles.map((v) => `${v.make} ${v.model} (${v.registration})`).join(" or ")}. If the vehicle is not listed, an adviser can help.`
              : "Please clarify what you want changed before I prepare a proposal.",
        );
      }
      if (
        c.context.clarification === "date" &&
        !p.date &&
        ["book", "modify", "symptom"].includes(p.intent)
      )
        return this.finish(
          c,
          "Please provide the exact date in YYYY-MM-DD before I check availability.",
        );
      if (
        c.context.clarification === "vehicle" &&
        !p.vehicleId &&
        ["book", "modify", "symptom"].includes(p.intent)
      )
        return this.finish(
          c,
          "Please choose a registered vehicle, or ask for an adviser.",
        );
      c.context.clarification = undefined;
      c.context.clarificationAttempts = 0;
      c.facts.push({
        label: "Requested workflow",
        value: p.intent,
        source: "inferred",
      });
      if (
        p.intent === "human" ||
        p.intent === "warranty" ||
        p.intent === "complaint" ||
        p.intent === "unsupported"
      ) {
        const reason = {
          human: "Customer requested a person",
          warranty: "Warranty coverage requires adviser verification",
          complaint:
            "Customer disputes previous work or requests complaint resolution",
          unsupported: "Requested service is outside the supported catalogue",
        }[p.intent];
        this.call(c, "create_service_request", {
          description: text.slice(0, 2000),
          ...(c.context.vehicleId ? { vehicleId: c.context.vehicleId } : {}),
        });
        const intro =
          p.intent === "warranty"
            ? "I can’t verify warranty coverage from the records available. "
            : p.intent === "unsupported"
              ? "That work is outside our published service catalogue. "
              : p.intent === "complaint"
                ? "I’m sorry this has been frustrating. A workshop adviser needs to review the work and your concerns. "
                : "";
        return this.finish(c, intro + this.handoff(c, reason, text));
      }
      if (p.intent === "hours") {
        const w = this.call<{ hours: string; address: string; policy: string }>(
          c,
          "get_workshop_information",
          {},
        );
        return this.finish(c, `${w.hours}\n${w.address}.\n${w.policy}`);
      }
      if (p.intent === "services" || p.intent === "price") {
        const all = this.call<Service[]>(c, "get_available_services", {});
        const selected =
          p.intent === "price" && p.serviceId
            ? all.filter((s) => s.id === p.serviceId)
            : all;
        return this.finish(
          c,
          selected
            .map(
              (s) =>
                `${s.name} — NOK ${s.price.toLocaleString("en-US")} for ${s.minutes} minutes. ${s.description}`,
            )
            .join("\n\n") +
            "\n\nThese are demonstration catalogue prices, not a repair quotation. Additional work requires a separate quote.",
        );
      }
      if (p.intent === "vehicle") {
        if (!c.context.vehicleId && ownVehicles.length !== 1)
          return this.finish(
            c,
            `Which vehicle’s record would you like? ${ownVehicles.map((v) => `${v.make} ${v.model} (${v.registration})`).join(" or ") || "An adviser can help register a vehicle."}`,
          );
        const v = this.call<Vehicle>(c, "get_vehicle_record", {
          vehicleId: c.context.vehicleId ?? ownVehicles[0].id,
        });
        return this.finish(
          c,
          `${v.make} ${v.model}: ${v.history.join(" ")} This record does not establish a current diagnosis or warranty coverage.`,
        );
      }
      if (["lookup", "modify", "cancel"].includes(p.intent))
        return this.bookingFlow(c, p);
      if (["book", "symptom"].includes(p.intent))
        return this.propose(c, ownVehicles);
      if (/^(yes|confirm|ok|okay|go ahead)[.! ]*$/i.test(text))
        return this.finish(
          c,
          "A written reply does not commit an appointment. Request a fresh proposal, review its details, then use its confirmation button.",
        );
      return this.finish(
        c,
        "I can help arrange service, look up your appointments, or connect you with an adviser. What does your car need?",
      );
    } catch (error) {
      return this.failed(c, error, safetyRequired);
    }
  }
  private bookingFlow(c: Conversation, p: Intent): Conversation {
    const found = this.call<Booking | Booking[]>(
      c,
      "get_booking",
      c.context.bookingId ? { bookingId: c.context.bookingId } : {},
    );
    const items = (Array.isArray(found) ? found : [found]).filter(
      (b) => b.status === "confirmed",
    );
    if (!items.length)
      return this.finish(
        c,
        "I couldn’t verify an active booking in your account. An employee’s promise is not a confirmed appointment. I can check new availability or ask an adviser to investigate.",
      );
    if (items.length > 1 && !c.context.bookingId)
      return this.finish(
        c,
        `Which booking do you mean? ${items.map((b) => b.id).join(", ")}.`,
      );
    const b = items[0];
    c.context.bookingId = b.id;
    const slot = this.store.slot(b.slotId)!;
    if (p.intent === "lookup")
      return this.finish(
        c,
        `Your verified booking ${b.id} is confirmed for ${slot.date} at ${slot.time} (Europe/Oslo). This reserves assessment time, not a repair completion deadline.`,
      );
    c.context.vehicleId = b.vehicleId;
    c.context.serviceId = b.serviceId;
    if (p.intent === "cancel") {
      const proposal: Proposal = {
        id: randomUUID(),
        action: "cancel",
        customerId: c.customerId,
        vehicleId: b.vehicleId,
        serviceId: b.serviceId,
        slotId: b.slotId,
        bookingId: b.id,
        version: b.version,
        expiresAt: new Date(this.store.now().getTime() + 600000).toISOString(),
        summary: `Cancel booking ${b.id} on ${slot.date} at ${slot.time} (Europe/Oslo).`,
      };
      c.proposal = proposal;
      return this.finish(
        c,
        "Please review the cancellation below. Your appointment remains confirmed until you confirm cancellation.",
      );
    }
    if (!c.context.date && !c.context.time)
      return this.finish(
        c,
        "What date would you like to move your appointment to? Your existing booking stays in place until a new time is confirmed.",
      );
    return this.propose(c, this.store.customerVehicles(c.customerId), b);
  }
  private propose(c: Conversation, vehicles: Vehicle[], booking?: Booking) {
    if (!c.context.serviceId)
      return this.finish(
        c,
        "What would you like us to look at — routine service, tyres, brakes, a warning light, or something else?",
      );
    if (!c.context.vehicleId && vehicles.length === 1)
      c.context.vehicleId = vehicles[0].id;
    if (!c.context.vehicleId) {
      if (!vehicles.length)
        return this.finish(
          c,
          `There isn’t a vehicle linked to your demo account. ${this.handoff(c, "Vehicle registration requires adviser assistance", "Book service")}`,
        );
      return this.finish(
        c,
        `Which vehicle is this for — ${vehicles.map((v) => `${v.make} ${v.model} (${v.registration})`).join(" or ")}?`,
      );
    }
    const v = this.call<Vehicle>(c, "get_vehicle_record", {
      vehicleId: c.context.vehicleId,
    });
    const catalogue = this.call<Service[]>(c, "get_available_services", {});
    const s = catalogue.find((s) => s.id === c.context.serviceId);
    if (!s) throw new Error("invalid service");
    const slots = this.call<Slot[]>(c, "get_available_slots", {
      serviceId: s.id,
      ...(c.context.date ? { date: c.context.date } : {}),
    });
    const selected = c.context.time
      ? slots.find((s) => s.time === c.context.time)
      : slots[0];
    if (!selected) {
      return this.finish(
        c,
        `I couldn’t find availability${c.context.date ? ` on ${c.context.date}` : ""}${c.context.time ? ` at ${c.context.time}` : ""}. No booking has been made.${
          slots.length
            ? ` Verified alternatives: ${slots
                .slice(0, 3)
                .map((s) => `${s.date} at ${s.time}`)
                .join(", ")}.`
            : " Please try a different weekday or ask for an adviser."
        }`,
      );
    }
    c.facts.push(
      {
        label: "Vehicle",
        value: `${v.make} ${v.model} / ${v.registration}`,
        source: "tool-verified",
      },
      {
        label: "Appointment availability",
        value: `${selected.date} ${selected.time}`,
        source: "tool-verified",
      },
      {
        label: "Repair completion",
        value: "Not established by an assessment appointment",
        source: "unknown",
      },
    );
    const summary = `${booking ? "Move" : "Book"} ${s.name.toLowerCase()} for your ${v.make} ${v.model} (${v.registration}) on ${selected.date} at ${selected.time} (Europe/Oslo). ${s.minutes}-minute assessment · NOK ${s.price.toLocaleString("en-US")}. Additional work quoted separately.${booking ? ` Replaces ${booking.id}.` : ""}`;
    c.proposal = {
      id: randomUUID(),
      action: booking ? "modify" : "create",
      customerId: c.customerId,
      vehicleId: v.id,
      serviceId: s.id,
      slotId: selected.id,
      bookingId: booking?.id,
      version: booking?.version,
      expiresAt: new Date(this.store.now().getTime() + 600000).toISOString(),
      summary,
    };
    return this.finish(
      c,
      `I found an appointment for your ${v.model}. Please review the details below. ${s.id === "diagnostic" || s.id === "brakes" || s.id === "ev" ? "An inspection is needed to determine the cause. " : ""}This time is available now but isn’t reserved until you confirm. We can’t promise when repairs will be finished.`,
    );
  }
  confirm(c: Conversation, proposalId: string) {
    this.tools.beginTurn(c);
    const action = c.proposal?.action;
    const r = this.tools.confirm(c, proposalId);
    c.proposal = undefined;
    if (!r.ok) return this.failed(c, new ToolFailure(r));
    const b = r.data as Booking;
    c.context = {};
    return this.finish(
      c,
      action === "cancel"
        ? `Booking ${b.id} is cancelled.`
        : action === "modify"
          ? `Booking ${b.id} has been moved to the appointment you confirmed.`
          : `Your appointment is confirmed. Reference ${b.id}. This reserves assessment time; additional repairs and completion times require workshop agreement.`,
    );
  }
  withdraw(c: Conversation) {
    c.proposal = undefined;
    c.context = {};
    return this.finish(
      c,
      "Proposal withdrawn. No booking was created or changed.",
    );
  }
  private failed(c: Conversation, error: unknown, safetyRequired = false) {
    c.proposal = undefined;
    const detail =
      error instanceof ToolFailure
        ? error.result.error.message
        : "I couldn’t reliably process that request.";
    let handoff = " Please try again or ask for a workshop adviser.";
    try {
      handoff =
        " " +
        this.handoff(
          c,
          error instanceof ToolFailure
            ? `Tool failure: ${error.result.error.code}`
            : "Planner or application failure",
          "Help customer continue after failure",
          safetyRequired,
        );
    } catch {
      /* A failed escalation must never be described as successful. */ handoff =
        " The adviser queue is also unavailable. No handoff was created. Please try again later.";
    }
    return this.finish(
      c,
      `${safetyRequired ? "Avoid driving until the vehicle has been assessed; arrange roadside assistance if needed. " : ""}${detail} No booking change was completed.${handoff}`,
    );
  }
}
class ToolFailure extends Error {
  constructor(public result: Extract<ToolResult, { ok: false }>) {
    super(result.error.message);
  }
}
