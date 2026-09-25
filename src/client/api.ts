export const publicDemo = import.meta.env.VITE_PUBLIC_DEMO === "true";
export async function api<T>(
  url: string,
  body?: unknown,
  token?: string,
): Promise<T> {
  const r = await fetch(
    publicDemo ? "/api/demo" : url,
    publicDemo
      ? {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            path: url,
            ...(body === undefined ? {} : { body }),
            ...(sessionStorage.getItem("sp_demo_state")
              ? { state: sessionStorage.getItem("sp_demo_state") }
              : {}),
          }),
        }
      : {
          method: body ? "POST" : "GET",
          headers: {
            ...(body ? { "Content-Type": "application/json" } : {}),
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          ...(body ? { body: JSON.stringify(body) } : {}),
        },
  );
  const raw = await r.text();
  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    throw new Error(
      r.status === 429
        ? "Too many requests. Please wait a minute and try again."
        : "The service returned an unreadable response. Your action is not confirmed; refresh before retrying.",
    );
  }
  if (!r.ok)
    throw new Error(data.error ?? "The request failed. Please try again.");
  if (publicDemo) {
    if (data.state) sessionStorage.setItem("sp_demo_state", data.state);
    return data.data;
  }
  return data;
}
export type EvaluationResult = {
  id: string;
  name: string;
  category: string;
  passed: boolean;
  expected: unknown;
  inputs: string[];
  actual: string;
  failures: string[];
  trace: import("../shared/domain").Trace[];
};
export type EvaluationRun = {
  id: string;
  at: string;
  provider: string;
  total: number;
  passed: number;
  failed: number;
  categories: Record<string, { total: number; passed: number }>;
  results?: EvaluationResult[];
};
