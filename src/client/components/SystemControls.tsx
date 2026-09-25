import { useState, type FormEvent } from "react";
import { ArrowRight } from "lucide-react";
import { api } from "../api";
import type { Overview } from "./Operations";
export function SystemControls({
  data,
  access,
}: {
  data: Overview;
  access: string;
}) {
  const [id, setId] = useState(data.conversations[0]?.id ?? "");
  const [tool, setTool] = useState("create_booking");
  const [failure, setFailure] = useState("timeout");
  const [notice, setNotice] = useState("");
  async function arm(e: FormEvent) {
    e.preventDefault();
    try {
      await api(
        "/api/internal/failure",
        { conversationId: id, tool, failure },
        access,
      );
      setNotice(
        `Armed ${failure} for the next ${tool} call in this conversation.`,
      );
    } catch (e) {
      setNotice((e as Error).message);
    }
  }
  return (
    <>
      <div className="section-heading">
        <h2>Inspect the boundaries.</h2>
        <p>Failures are injected once, into one conversation and one tool.</p>
      </div>
      <div className="system-grid">
        <div>
          <dl className="system-facts">
            <dt>Language planner</dt>
            <dd>{data.provider}</dd>
            <dt>Business system</dt>
            <dd>{data.database}</dd>
            <dt>Mutation gate</dt>
            <dd>Explicit confirmation + ownership + fresh capacity</dd>
            <dt>Model calls per turn</dt>
            <dd>Maximum 1 · 12-second timeout · 700 output tokens</dd>
            <dt>Customer data</dt>
            <dd>Fictional seeded accounts only</dd>
            <dt>Evaluation execution</dt>
            <dd>CLI only · Paid mode requires an explicit opt-in</dd>
          </dl>
        </div>
        <form className="failure-form" onSubmit={arm}>
          <p className="eyebrow">FAILURE INJECTION</p>
          <h3>What happens when a tool fails?</h3>
          <label>
            Conversation
            <select value={id} onChange={(e) => setId(e.target.value)} required>
              {data.conversations.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.customerId} / {c.id.slice(0, 8)}
                </option>
              ))}
            </select>
          </label>
          <label>
            Tool
            <select value={tool} onChange={(e) => setTool(e.target.value)}>
              {[
                "create_booking",
                "get_available_slots",
                "modify_booking",
                "cancel_booking",
                "get_booking",
                "get_vehicle_record",
                "escalate_to_human",
              ].map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </label>
          <label>
            Failure
            <select
              value={failure}
              onChange={(e) => setFailure(e.target.value)}
            >
              {[
                "timeout",
                "unavailable",
                "invalid_response",
                "conflict",
                "not_found",
                "stale",
              ].map((f) => (
                <option key={f}>{f}</option>
              ))}
            </select>
          </label>
          <button className="button" disabled={!id}>
            Arm one-shot failure <ArrowRight size={16} />
          </button>
          <p className="muted" role="status">
            {notice ||
              "Return to the service desk and perform the matching action. Inspect the resulting trace here."}
          </p>
        </form>
      </div>
    </>
  );
}
