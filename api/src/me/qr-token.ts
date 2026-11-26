import { createHmac, timingSafeEqual } from "node:crypto";
import { QR_PREFIX } from "@cms/shared";
import { z } from "zod";

export type QrType = "service" | "member";

export interface QrClaims {
  type: QrType;
  /** Service ID or member ID. */
  id: string;
  /** Member tokens only: the account's token version, so signing out everywhere revokes the code. */
  version?: number;
  expiresAt: Date;
}

const payloadSchema = z.object({
  t: z.enum(["service", "member"]),
  id: z.uuid(),
  v: z.number().int().nonnegative().optional(),
  exp: z.number().int().positive(),
});

/**
 * Compact signed tokens for QR codes: "cmsqr1.<payload>.<signature>", HMAC-SHA256 with a key derived
 * from the server secret (never the session key itself, so a QR token can never act as a session).
 */
export class QrTokens {
  private readonly key: Buffer;

  constructor(secret: string) {
    if (secret.length < 32) throw new Error("QR signing needs a secret of at least 32 characters");
    this.key = createHmac("sha256", secret).update("cms-qr-tokens-v1").digest();
  }

  sign(claims: Omit<QrClaims, "expiresAt">, expiresAt: Date): string {
    const body = Buffer.from(
      JSON.stringify({ t: claims.type, id: claims.id, ...(claims.version === undefined ? {} : { v: claims.version }), exp: expiresAt.getTime() }),
    ).toString("base64url");
    return `${QR_PREFIX}${body}.${this.mac(body)}`;
  }

  /** The claims, or null if the token is malformed, forged, expired, or of another type. */
  verify(token: string, type: QrType, now: Date): QrClaims | null {
    if (!token.startsWith(QR_PREFIX)) return null;
    const parts = token.slice(QR_PREFIX.length).split(".");
    if (parts.length !== 2) return null;
    const [body, sig] = parts;
    const expected = Buffer.from(this.mac(body));
    const given = Buffer.from(sig);
    if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
    let raw: unknown;
    try {
      raw = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    } catch {
      return null;
    }
    const payload = payloadSchema.safeParse(raw);
    if (!payload.success || payload.data.t !== type || payload.data.exp <= now.getTime()) return null;
    return { type, id: payload.data.id, version: payload.data.v, expiresAt: new Date(payload.data.exp) };
  }

  private mac(body: string): string {
    return createHmac("sha256", this.key).update(body).digest("base64url");
  }
}
