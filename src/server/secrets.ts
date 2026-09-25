/** Server-only defence in depth. Never include environment values in client code. */
export function redactSecrets(text: string): string {
  for (const name of [
    "OPENAI_API_KEY",
    "ANTHROPIC_API_KEY",
    "ADMIN_TOKEN",
    "DEMO_SESSION_SECRET",
  ]) {
    const value = process.env[name];
    if (value) text = text.split(value).join("[REDACTED]");
  }
  // Also remove recognisable credentials accidentally supplied by a customer.
  return text.replace(/\bsk-[A-Za-z0-9_-]{20,}\b/g, "[REDACTED]");
}

/** Use at JSON sinks so nested model output and legacy records are covered. */
export function secretJsonReplacer(_key: string, value: unknown): unknown {
  return typeof value === "string" ? redactSecrets(value) : value;
}
