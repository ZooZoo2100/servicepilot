import { useState } from "react";
import { ChevronDown } from "lucide-react";
import type { EvaluationRun } from "../api";
import { TraceList } from "./TraceList";
import { Empty } from "./Empty";
export function EvaluationLab({ runs }: { runs: EvaluationRun[] }) {
  const [selected, setSelected] = useState(runs[0]?.id ?? "");
  const [filter, setFilter] = useState("all");
  const [category, setCategory] = useState("all");
  const run = runs.find((r) => r.id === selected) ?? runs[0];
  if (!run)
    return (
      <Empty
        title="No evaluation evidence yet"
        text="Run npm run eval from the repository. Evaluation runs are deliberate and never launch paid requests from this page."
      />
    );
  const results = (run.results ?? []).filter(
    (r) =>
      (filter === "all" || !r.passed) &&
      (category === "all" || category === r.category),
  );
  return (
    <>
      <div className="section-heading">
        <div>
          <p className="eyebrow">EVIDENCE, NOT ASSUMPTIONS</p>
          <h2>Evaluation Lab</h2>
        </div>
        <label className="select-label">
          Recorded run
          <select value={run.id} onChange={(e) => setSelected(e.target.value)}>
            {runs.map((r) => (
              <option key={r.id} value={r.id}>
                {new Date(r.at).toLocaleString()} · {r.passed}/{r.total}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="eval-metrics">
        <div>
          <span className="eyebrow">SCENARIOS</span>
          <strong>{run.total}</strong>
        </div>
        <div>
          <span className="eyebrow">PASS RATE</span>
          <strong>
            {((run.passed / run.total) * 100).toFixed(1)}
            <em>%</em>
          </strong>
        </div>
        <div>
          <span className="eyebrow">FAILURES</span>
          <strong className={run.failed ? "rust" : ""}>{run.failed}</strong>
        </div>
        <div className="metric-explainer">
          <span className="tiny-tag">{run.provider.toUpperCase()}</span>
          <p>
            Deterministic assertions against actual traces and database changes.{" "}
            {run.provider === "simulation"
              ? "This run does not measure live LLM quality."
              : "This run exercises a live language model."}
          </p>
        </div>
      </div>
      <details className="category-breakdown">
        <summary>
          Results by category <ChevronDown size={16} />
        </summary>
        <div className="category-grid">
          {Object.entries(run.categories).map(([name, c]) => (
            <div key={name}>
              <span>{name}</span>
              <span>
                {c.passed}/{c.total}
              </span>
              <div className="bar">
                <i style={{ width: `${(c.passed / c.total) * 100}%` }} />
              </div>
            </div>
          ))}
        </div>
      </details>
      <div className="filter-row">
        <div className="segmented">
          <button
            aria-pressed={filter === "all"}
            onClick={() => setFilter("all")}
          >
            All scenarios
          </button>
          <button
            aria-pressed={filter === "failed"}
            onClick={() => setFilter("failed")}
          >
            Failures only ({run.failed})
          </button>
        </div>
        <label>
          <span className="sr-only">Category</span>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            <option value="all">All categories</option>
            {Object.keys(run.categories).map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
        <span className="muted">{results.length} {results.length === 1 ? "result" : "results"}</span>
      </div>
      {results.length ? (
        results.map((r) => (
          <details className="record" key={r.id}>
            <summary>
              <span className={`result-badge ${r.passed ? "pass" : "fail"}`}>
                {r.passed ? "PASS" : "FAIL"}
              </span>
              <span className="record-title">
                {r.name}
                <small>
                  {r.id} / {r.category}
                </small>
              </span>
              <ChevronDown size={17} />
            </summary>
            <div className="record-content">
              <p className="eyebrow">CUSTOMER INPUT</p>
              <p className="preserve">{r.inputs.join("\n")}</p>
              <div className="comparison">
                <div>
                  <p className="eyebrow">EXPECTED BEHAVIOUR</p>
                  <pre>{JSON.stringify(r.expected, null, 2)}</pre>
                </div>
                <div>
                  <p className="eyebrow">ACTUAL RESPONSE</p>
                  <p className="preserve">{r.actual}</p>
                  {r.failures.map((f) => (
                    <p className="error" key={f}>
                      {f}
                    </p>
                  ))}
                </div>
              </div>
              <TraceList traces={r.trace} />
            </div>
          </details>
        ))
      ) : (
        <Empty
          title="No failures in this selection"
          text="Passing assertions are evidence for these scenarios, not a guarantee for every possible conversation."
        />
      )}
    </>
  );
}
