import { createHmac, timingSafeEqual } from "node:crypto";

export interface HmacVerificationResult {
  valid: boolean;
  reason?: string;
}

/**
 * Computes `hmac_sha256(secret, `${timestamp}.${rawBody}`)` hex signature
 * matching DOC-16 section 3.2 for Face ID Sync Agent webhooks.
 */
export function computeFaceIdSignature(
  secret: string,
  timestampHeader: string,
  rawBody: string
): string {
  return createHmac("sha256", secret)
    .update(`${timestampHeader}.${rawBody}`, "utf8")
    .digest("hex");
}

/**
 * Verifies Face ID Sync Agent webhook signature and prevents replay attacks
 * outside the ±300s clock skew window.
 */
export function verifyFaceIdWebhookSignature(params: {
  secret: string | undefined;
  timestampHeader: string | null;
  signatureHeader: string | null;
  rawBody: string;
  nowEpochSeconds?: number;
  maxSkewSeconds?: number;
}): HmacVerificationResult {
  if (!params.secret) {
    return { valid: false, reason: "Missing FACE_ID_WEBHOOK_SECRET on server." };
  }
  if (!params.timestampHeader || !params.signatureHeader) {
    return { valid: false, reason: "Missing X-Timestamp or X-Signature-HMAC header." };
  }

  const ts = Number(params.timestampHeader);
  if (!Number.isFinite(ts)) {
    return { valid: false, reason: "Invalid X-Timestamp header." };
  }

  const now = params.nowEpochSeconds ?? Math.floor(Date.now() / 1000);
  const maxSkew = params.maxSkewSeconds ?? 300;
  if (Math.abs(now - ts) > maxSkew) {
    return {
      valid: false,
      reason: `Webhook timestamp outside ±${maxSkew}s replay window.`,
    };
  }

  const expectedHex = computeFaceIdSignature(params.secret, params.timestampHeader, params.rawBody);
  const providedHex = params.signatureHeader.replace(/^sha256=/i, "").trim().toLowerCase();

  const expectedBuf = Buffer.from(expectedHex, "utf8");
  const providedBuf = Buffer.from(providedHex, "utf8");

  if (expectedBuf.length !== providedBuf.length) {
    return { valid: false, reason: "HMAC signature length mismatch." };
  }

  if (!timingSafeEqual(expectedBuf, providedBuf)) {
    return { valid: false, reason: "HMAC signature verification failed." };
  }

  return { valid: true };
}

