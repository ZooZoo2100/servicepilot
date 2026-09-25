import { Empty } from "./Empty";
import { TraceList } from "./TraceList";
import { EvaluationLab } from "./EvaluationLab";
import { SystemControls } from "./SystemControls";
import { useEffect, useState, type FormEvent } from "react";
import {
  ArrowRight,
  ChevronDown,
  LockKeyhole,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import type { Booking, Conversation, Handoff } from "../../shared/domain";
import { api, publicDemo, type EvaluationRun } from "../api";
export type Overview = {
  conversations: Conversation[];
  handoffs: Handoff[];
  requests: { id: string; description: string; status: string }[];
  bookings: Booking[];
  provider: string;
  database: string;
};
export function Operations() {
  const [token, setToken] = useState("");
  const [access, setAccess] = useState("");
  const [data, setData] = useState<Overview>();
  const [runs, setRuns] = useState<EvaluationRun[]>([]);
  const [tab, setTab] = useState(
    location.hash === "#evaluations" ? "evaluations" : "handoffs",
  );
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  async function load(key = access) {
    setLoading(true);
    setError("");
    try {
      const [overview, evaluations] = await Promise.all([
        api<Overview>("/api/internal/overview", undefined, key),
        api<EvaluationRun[]>("/api/internal/evaluations", undefined, key),
      ]);
      setData(overview);
      setRuns(evaluations);
      setAccess(key);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    if (publicDemo) void load();
  }, []);
  function login(e: FormEvent) {
    e.preventDefault();
    void load(token);
  }
  if (publicDemo && !data)
    return (
      <main id="main" className="access-page">
        <div className="access-heading">
          <p className="eyebrow">SERVICEPILOT / READ-ONLY PORTFOLIO EVIDENCE</p>
          <h1>The workshop desk.</h1>
          {error ? (
            <>
              <p role="alert" className="error">
                {error}
              </p>
              <button className="button" onClick={() => void load()}>
                Retry
              </button>
            </>
          ) : (
            <p role="status">Loading fictional demonstration evidence…</p>
          )}
        </div>
      </main>
    );
  if (!data)
    return (
      <main id="main" className="access-page">
        <div className="access-heading">
          <p className="eyebrow">SERVICEPILOT / INTERNAL</p>
          <LockKeyhole size={30} strokeWidth={1.4} />
          <h1>
            The workshop,
            <br />
            behind the conversation.
          </h1>
          <p>
            Review handoffs, inspect tool results, and examine the evidence in
            the Evaluation Lab.
          </p>
        </div>
        <form className="access-form" onSubmit={login}>
          <label htmlFor="token">Operations access token</label>
          <input
            id="token"
            type="password"
            autoComplete="current-password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            required
          />
          <p className="muted">
            Use the ADMIN_TOKEN configured on your server. Access is checked on
            every internal API request.
          </p>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          <button className="button" disabled={loading}>
            {loading ? "Checking access…" : "Open operations"}{" "}
            <ArrowRight size={16} />
          </button>
          <div className="privacy-note">
            <ShieldCheck size={18} />
            <p>
              Internal records stay behind this boundary. The access token is
              held in memory for this visit only.
            </p>
          </div>
        </form>
      </main>
    );
  return (
    <main id="main" className="operations">
      <div className="page-title">
        <div>
          <p className="eyebrow">
            {publicDemo
              ? "SERVICEPILOT / READ-ONLY DEMONSTRATION"
              : "SERVICEPILOT / INTERNAL OPERATIONS"}
          </p>
          <h1>The workshop desk.</h1>
          <p>
            {publicDemo
              ? "Curated fictional records. Visitor conversations never appear here."
              : "Every conversation. Every decision. A trace you can inspect."}
          </p>
        </div>
        <div className="page-actions">
          <span className="tiny-tag">{data.provider}</span>
          <button
            className="button secondary"
            onClick={() => void load()}
            disabled={loading}
          >
            <RefreshCw size={15} /> Refresh
          </button>
          {!publicDemo && (
            <button
              className="text-button"
              onClick={() => {
                setData(undefined);
                setAccess("");
                setToken("");
              }}
            >
              Lock
            </button>
          )}
        </div>
      </div>
      <div
        className="ops-nav"
        role="tablist"
        aria-label="Operations views"
        onKeyDown={(e) => {
          if (!["ArrowRight", "ArrowLeft", "Home", "End"].includes(e.key))
            return;
          e.preventDefault();
          const tabs = Array.from(
            e.currentTarget.querySelectorAll<HTMLButtonElement>("[role=tab]"),
          );
          const i = tabs.indexOf(document.activeElement as HTMLButtonElement);
          const next =
            e.key === "Home"
              ? 0
              : e.key === "End"
                ? tabs.length - 1
                : (i + (e.key === "ArrowRight" ? 1 : -1) + tabs.length) %
                  tabs.length;
          tabs[next].focus();
          tabs[next].click();
        }}
      >
        {[
          ["handoffs", "Handoffs", data.handoffs.length],
          ["conversations", "Conversations", data.conversations.length],
          [
            "bookings",
            "Bookings",
            data.bookings.filter((b) => b.status === "confirmed").length,
          ],
          ["evaluations", "Evaluation Lab", runs[0]?.total ?? 0],
          ["system", "System & failure controls", ""],
        ]
          .filter(([id]) => !publicDemo || id !== "system")
          .map(([id, label, count]) => (
            <button
              key={id}
              role="tab"
              id={`tab-${id}`}
              aria-controls="ops-panel"
              tabIndex={tab === id ? 0 : -1}
              aria-selected={tab === id}
              onClick={() => setTab(String(id))}
            >
              {label} <span>{count}</span>
            </button>
          ))}
      </div>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      <div role="tabpanel" id="ops-panel" aria-labelledby={`tab-${tab}`}>
        {tab === "handoffs" && (
          <>
            <div className="section-heading">
              <h2>Needs a human.</h2>
              <p>A handoff is a next step, never a claim of resolution.</p>
            </div>
            {!data.handoffs.length ? (
              <Empty
                title="No handoffs waiting"
                text="Ask the service desk about warranty coverage, report a safety concern, or request a person."
              />
            ) : (
              data.handoffs.map((h) => (
                <details className="record" key={h.id}>
                  <summary>
                    <span
                      className={`record-tag ${h.urgency === "urgent" ? "urgent" : ""}`}
                    >
                      {h.urgency === "urgent" ? "PRIORITY" : "WAITING"}
                    </span>
                    <span className="record-title">
                      {h.reason}
                      <small>
                        {h.id} · {h.customerId} ·{" "}
                        {new Date(h.createdAt).toLocaleString()}
                      </small>
                    </span>
                    <ChevronDown size={17} />
                  </summary>
                  <div className="record-content">
                    <div className="handoff-grid">
                      <div>
                        <p className="eyebrow">CUSTOMER’S REQUEST</p>
                        <p className="preserve">{h.summary}</p>
                        <p className="eyebrow">INTENT / VEHICLE</p>
                        <p>
                          {h.intent} · {h.vehicleId ?? "Not established"}
                        </p>
                        <p className="eyebrow">ACTIONS ATTEMPTED</p>
                        <p>{h.actionsAttempted.join(" → ")}</p>
                      </div>
                      <div>
                        <p className="eyebrow">COLLECTED FACTS</p>
                        {h.facts.map((f, i) => (
                          <div className="fact" key={i}>
                            <span className="tiny-tag">{f.source}</span>
                            <p>
                              <strong>{f.label}</strong>
                              <br />
                              {f.value}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                    <TraceList traces={h.toolResults} />
                  </div>
                </details>
              ))
            )}
            <div className="section-heading">
              <h2>Service requests</h2>
            </div>
            {data.requests.length ? (
              data.requests.map((r) => (
                <div className="request-row" key={r.id}>
                  <code>{r.id}</code>
                  <p>{r.description}</p>
                  <span className="tiny-tag">{r.status}</span>
                </div>
              ))
            ) : (
              <p className="muted">No service requests recorded.</p>
            )}
          </>
        )}
        {tab === "conversations" && (
          <>
            <div className="section-heading">
              <h2>From words to actions.</h2>
              <p>
                Planner interpretations are separate from tool-verified facts.
              </p>
            </div>
            {!data.conversations.length ? (
              <Empty
                title="No conversations yet"
                text="Start with the customer service desk. The conversation and its trace will appear here."
              />
            ) : (
              data.conversations.map((c) => (
                <details className="record" key={c.id}>
                  <summary>
                    <span className="record-tag">
                      {c.handoffId
                        ? "HANDOFF"
                        : c.proposal
                          ? "PROPOSAL"
                          : "ACTIVE"}
                    </span>
                    <span className="record-title">
                      {c.messages
                        .filter((m) => m.role === "user")
                        .at(-1)
                        ?.text.slice(0, 100) ?? "New conversation"}
                      <small>
                        {c.customerId} · {c.id.slice(0, 8)} · {c.traces.length}{" "}
                        tool calls
                      </small>
                    </span>
                    <ChevronDown size={17} />
                  </summary>
                  <div className="record-content">
                    <div className="transcript">
                      {c.messages.map((m) => (
                        <p key={m.id}>
                          <span className="eyebrow">{m.role}</span>
                          <br />
                          {m.text}
                        </p>
                      ))}
                    </div>
                    <div className="facts-row">
                      {c.facts.slice(-5).map((f, i) => (
                        <div className="fact" key={i}>
                          <span className="tiny-tag">{f.source}</span>
                          <p>
                            {f.label}: {f.value}
                          </p>
                        </div>
                      ))}
                    </div>
                    <TraceList traces={c.traces} />
                    <details>
                      <summary>Final conversation state</summary>
                      <pre>
                        {JSON.stringify(
                          {
                            planning: c.planning,
                            context: c.context,
                            proposal: c.proposal,
                            handoffId: c.handoffId,
                            revision: c.revision,
                          },
                          null,
                          2,
                        )}
                      </pre>
                    </details>
                  </div>
                </details>
              ))
            )}
          </>
        )}
        {tab === "bookings" && (
          <>
            <div className="section-heading">
              <h2>The appointment ledger.</h2>
              <p>Seeded records and successfully committed demo operations.</p>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Reference</th>
                    <th>Customer / vehicle</th>
                    <th>Service</th>
                    <th>Slot · Europe/Oslo</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {data.bookings.map((b) => (
                    <tr key={b.id}>
                      <td>
                        <code>{b.id}</code>
                      </td>
                      <td>
                        {b.customerId}
                        <small>{b.vehicleId}</small>
                      </td>
                      <td>{b.serviceId}</td>
                      <td>{b.slotId.replaceAll("_", " · ")}</td>
                      <td>
                        <span className="tiny-tag">{b.status}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
        {tab === "evaluations" && <EvaluationLab runs={runs} />}{" "}
        {tab === "system" && <SystemControls data={data} access={access} />}
      </div>
    </main>
  );
}
