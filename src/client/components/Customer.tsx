import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  ArrowRight,
  ArrowUp,
  Check,
  Clock3,
  MapPin,
  Plus,
  ShieldCheck,
  X,
} from "lucide-react";
import type { CustomerView } from "../../shared/domain";
import { api, publicDemo } from "../api";
const starters = [
  {
    n: "01",
    title: "Book a service",
    text: "Book routine service for my Golf",
  },
  {
    n: "02",
    title: "Something doesn’t feel right",
    text: "My Model 3 has a knocking noise from the front. Can you look at it?",
  },
  {
    n: "03",
    title: "Manage an appointment",
    text: "Check my booking BK-DEMO-NORA",
  },
];
export function Customer() {
  const [config, setConfig] = useState<{
    provider: string;
    demoMode: boolean;
  }>();
  const [customer, setCustomer] = useState("c-nora");
  const [conversation, setConversation] = useState<CustomerView>();
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const end = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    api<{ provider: string; demoMode: boolean }>("/api/config")
      .then(setConfig)
      .catch((e) => setError(e.message));
    const id = sessionStorage.getItem("sp_conversation");
    if (id)
      api<CustomerView>(`/api/conversations/${id}`)
        .then(setConversation)
        .catch(() => sessionStorage.removeItem("sp_conversation"));
  }, []);
  useEffect(() => {
    if (conversation && conversation.messages.length > 1)
      end.current?.scrollIntoView({ behavior: "instant", block: "nearest" });
  }, [conversation, busy]);
  async function start() {
    const c = await api<CustomerView>("/api/session", { customerId: customer });
    setConversation(c);
    sessionStorage.setItem("sp_conversation", c.id);
    return c;
  }
  async function send(text: string) {
    if (busy || !text.trim()) return;
    setBusy(true);
    setError("");
    try {
      const c = conversation ?? (await start());
      const updated = await api<CustomerView>(
        `/api/conversations/${c.id}/message`,
        { text: text.trim(), revision: c.revision },
      );
      setConversation(updated);
      setDraft("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
      input.current?.focus();
    }
  }
  async function act(action: "confirm" | "withdraw") {
    if (!conversation) return;
    setBusy(true);
    setError("");
    try {
      setConversation(
        await api<CustomerView>(
          `/api/conversations/${conversation.id}/${action}`,
          {
            revision: conversation.revision,
            ...(action === "confirm"
              ? { proposalId: conversation.proposal?.id }
              : {}),
          },
        ),
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function submit(e: FormEvent) {
    e.preventDefault();
    void send(draft);
  }
  const started = conversation && conversation.messages.length > 1;
  return (
    <main id="main" className="customer-layout">
      <aside className="workshop-panel">
        <div>
          <p className="eyebrow">THE SERVICE DESK / OSLO</p>
          <h1>
            Good care.
            <br /> Clear answers.
          </h1>
          <p className="intro">
            A little less uncertainty.
            <br /> For you, and your car.
          </p>
        </div>
        <div className="workshop-line" />
        <div className="workshop-details">
          <p>
            <Clock3 size={17} />
            <span>
              Monday–Friday<small>08:00–16:00 · Europe/Oslo</small>
            </span>
          </p>
          <p>
            <MapPin size={17} />
            <span>
              Varde Motorverksted<small>A fictional independent workshop</small>
            </span>
          </p>
        </div>
        <div className="service-index">
          <p className="eyebrow">HERE TO HELP WITH</p>
          <span>Routine servicing</span>
          <span>Tyres & brakes</span>
          <span>Diagnostics & electric vehicles</span>
        </div>
        <div className="panel-foot">
          <ShieldCheck size={19} />
          <p>
            You review the details.
            <br />
            Nothing is booked without your say.
          </p>
        </div>
      </aside>
      <section className="desk" aria-label="Workshop conversation">
        <div className="desk-heading">
          <div>
            <p className="eyebrow">VARDE ASSISTANT</p>
            <h2>Let’s take care of it.</h2>
          </div>
          <button
            className="text-button"
            disabled={busy}
            onClick={() => {
              setConversation(undefined);
              setError("");
              sessionStorage.removeItem("sp_conversation");
              setDraft("");
            }}
          >
            <Plus size={16} /> New conversation
          </button>
        </div>
        <div className="environment-note">
          <span className="tiny-tag">DEMO</span>
          <p>
            {config?.provider === "simulation"
              ? publicDemo
                ? "Temporary simulation · No real bookings or messages. Use fictional details only."
                : "Offline simulation · No real bookings or messages are sent."
              : `${config?.provider ?? "Loading"} language model · All workshop records and actions are fictional.`}
          </p>
        </div>
        {!started && (
          <div className="welcome">
            <div className="account-selector">
              <label htmlFor="demo-customer">
                Try a fictional customer account
              </label>
              <select
                id="demo-customer"
                value={customer}
                disabled={!!conversation || busy}
                onChange={(e) => setCustomer(e.target.value)}
              >
                <option value="c-nora">Nora Berg · Model 3 & Golf</option>
                <option value="c-erik">Erik Lund · Volvo V60</option>
                <option value="c-new">
                  Alex Strand · No registered vehicle
                </option>
              </select>
            </div>
            <p className="welcome-copy">
              Tell us what you need.
              <br />
              <span>We’ll work out the next step together.</span>
            </p>
            <div className="starters">
              {starters.map((s) => (
                <button
                  key={s.n}
                  onClick={() => void send(s.text)}
                  disabled={busy}
                >
                  <span className="starter-number">{s.n}</span>
                  <span>{s.title}</span>
                  <ArrowUpRightIcon />
                </button>
              ))}
            </div>
          </div>
        )}
        <div
          className={`conversation ${started ? "has-messages" : ""}`}
          role="log"
          aria-label="Conversation messages"
          aria-live="polite"
        >
          {started &&
            conversation.messages.map((m) => (
              <article key={m.id} className={`message ${m.role}`}>
                <div className="message-meta">
                  {m.role === "assistant" ? (
                    <>
                      <span className="mini-mark">V</span> VARDE
                    </>
                  ) : (
                    "YOU"
                  )}
                  <time dateTime={m.at}>
                    {new Date(m.at).toLocaleTimeString("en-GB", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </time>
                </div>
                <div className="message-body">{m.text}</div>
              </article>
            ))}
          {busy && (
            <div className="loading" role="status">
              <span className="loading-dots">···</span> Checking your request…
            </div>
          )}
          {conversation?.proposal && (
            <section className="proposal" aria-label="Appointment proposal">
              <div className="proposal-label">
                <span>REVIEW & CONFIRM</span>
                <Clock3 size={16} />
              </div>
              <h3>
                {conversation.proposal.action === "cancel"
                  ? "Cancel this appointment?"
                  : conversation.proposal.action === "modify"
                    ? "Your revised appointment"
                    : "An appointment for your car"}
              </h3>
              <p>{conversation.proposal.summary}</p>
              <p className="muted">
                Proposal valid for 10 minutes. Availability is checked again
                when you confirm.
              </p>
              <div className="proposal-actions">
                <button
                  className={
                    conversation.proposal.action === "cancel"
                      ? "button danger"
                      : "button"
                  }
                  disabled={busy}
                  onClick={() => void act("confirm")}
                >
                  <Check size={16} />
                  {conversation.proposal.action === "cancel"
                    ? "Confirm cancellation"
                    : conversation.proposal.action === "modify"
                      ? "Confirm change"
                      : "Confirm appointment"}
                </button>
                <button
                  className="button secondary"
                  disabled={busy}
                  onClick={() => void act("withdraw")}
                >
                  <X size={15} /> Withdraw
                </button>
              </div>
            </section>
          )}
          {conversation?.handoffId && (
            <div className="handoff-note">
              <span className="status-dot" />
              <div>
                <strong>With the workshop adviser queue</strong>
                <p>
                  {conversation.handoffId} · Simulated handoff · Awaiting review
                </p>
              </div>
            </div>
          )}
          <div ref={end} />
        </div>
        <div className="composer-area">
          {error && (
            <p role="alert" className="error">
              {error}
            </p>
          )}
          <form onSubmit={submit} className="composer">
            <label className="sr-only" htmlFor="message">
              Your message
            </label>
            <textarea
              id="message"
              ref={input}
              value={draft}
              maxLength={2000}
              disabled={busy || config?.demoMode === false}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void send(draft);
                }
              }}
              placeholder="What can we help you with?"
              rows={2}
            />
            <button
              className="send-button"
              type="submit"
              aria-label="Send message"
              disabled={busy || !draft.trim()}
            >
              <ArrowUp size={20} />
            </button>
          </form>
          <div className="composer-caption">
            <span>Enter to send · Shift + Enter for a new line</span>
            <span>{draft.length}/2,000</span>
          </div>
          <button
            className="adviser-link"
            disabled={busy}
            onClick={() =>
              void send("I would like to speak to a human adviser")
            }
          >
            Prefer to speak with a person? <ArrowRight size={14} />
          </button>
        </div>
      </section>
    </main>
  );
}
function ArrowUpRightIcon() {
  return (
    <svg
      aria-hidden="true"
      width="17"
      height="17"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <path d="M6 18 18 6M6 6h12v12" />
    </svg>
  );
}
