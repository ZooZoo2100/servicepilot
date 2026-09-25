import { ChevronDown } from "lucide-react";
import type { Trace } from "../../shared/domain";
export function TraceList({ traces }: { traces: Trace[] }) {
  return (
    <div className="trace-list">
      <p className="eyebrow">CONTROLLED TOOL TRACE</p>
      {traces.length ? (
        traces.map((t, i) => (
          <details className="trace" key={t.id}>
            <summary>
              <span className="trace-number">
                {String(i + 1).padStart(2, "0")}
              </span>
              <code>{t.name}</code>
              <span className={t.result.ok ? "trace-ok" : "trace-error"}>
                {t.result.ok ? "OK" : t.result.error.code}
              </span>
              <small>{t.latencyMs} ms</small>
              <ChevronDown size={13} />
            </summary>
            <div className="trace-body">
              <div>
                <span className="eyebrow">VALIDATED ARGUMENTS</span>
                <pre>{JSON.stringify(t.args, null, 2)}</pre>
              </div>
              <div>
                <span className="eyebrow">RESULT</span>
                <pre>{JSON.stringify(t.result, null, 2)}</pre>
              </div>
            </div>
          </details>
        ))
      ) : (
        <p className="muted">No tool calls.</p>
      )}
    </div>
  );
}
