import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";
import { deflateSync, inflateSync } from "node:zlib";
import { z } from "zod";
const stateSchema = z
  .object({
    version: z.literal(1),
    expiresAt: z.number().int(),
    customerId: z.enum(["c-nora", "c-erik", "c-new"]),
    conversationId: z.string().uuid(),
    database: z.string().max(1400000),
  })
  .strict();
export type DemoState = z.infer<typeof stateSchema>;
export const SESSION_MS = 30 * 60 * 1000;
function key() {
  const secret = process.env.DEMO_SESSION_SECRET;
  if (!secret || secret.length < 32) throw new Error("DEMO_NOT_CONFIGURED");
  return createHash("sha256").update(secret).digest();
}
export function sealState(state: DemoState) {
  const input = Buffer.from(JSON.stringify(stateSchema.parse(state)));
  if (input.length > 1500000) throw new Error("DEMO_SESSION_LIMIT");
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  cipher.setAAD(Buffer.from("servicepilot-demo-v2-dk"));
  const encrypted = Buffer.concat([
    cipher.update(deflateSync(input)),
    cipher.final(),
  ]);
  const token = Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString(
    "base64url",
  );
  if (token.length > 200000) throw new Error("DEMO_SESSION_LIMIT");
  return token;
}
export function openState(token: string, now = Date.now()): DemoState {
  if (!/^[A-Za-z0-9_-]{40,200000}$/.test(token))
    throw new Error("INVALID_DEMO_SESSION");
  const data = Buffer.from(token, "base64url");
  const decipher = createDecipheriv("aes-256-gcm", key(), data.subarray(0, 12));
  decipher.setAAD(Buffer.from("servicepilot-demo-v2-dk"));
  decipher.setAuthTag(data.subarray(12, 28));
  const compressed = Buffer.concat([
    decipher.update(data.subarray(28)),
    decipher.final(),
  ]);
  const state = stateSchema.parse(
    JSON.parse(
      inflateSync(compressed, { maxOutputLength: 1500000 }).toString(),
    ),
  );
  if (state.expiresAt <= now || state.expiresAt > now + SESSION_MS + 1000)
    throw new Error("EXPIRED_DEMO_SESSION");
  return state;
}
