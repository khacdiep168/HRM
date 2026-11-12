import crypto from "node:crypto";

const AES_ALGO = "aes-256-gcm";
const IV_LENGTH = 12;

function decodeKey(base64Key: string, label: string): Buffer {
  const buf = Buffer.from(base64Key, "base64");
  if (buf.length !== 32) {
    throw new Error(`${label} must decode to exactly 32 bytes (256 bits).`);
  }
  return buf;
}

/**
 * Encrypts sensitive PII (CCCD, bank account, tax code, phone) using AES-256-GCM
 * before persisting to Supabase Postgres.
 */
export function encryptPii(plaintext: string, base64Key: string): string {
  const key = decodeKey(base64Key, "PII_ENCRYPTION_KEY_BASE64");
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(AES_ALGO, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString("base64")}.${authTag.toString("base64")}.${encrypted.toString("base64")}`;
}

/**
 * Decrypts AES-256-GCM ciphertext stored in Supabase Postgres.
 * Callers MUST log access to `access_logs` whenever unmasking PII for a user.
 */
export function decryptPii(ciphertext: string, base64Key: string): string {
  const key = decodeKey(base64Key, "PII_ENCRYPTION_KEY_BASE64");
  const parts = ciphertext.split(".");
  if (parts.length !== 3) {
    throw new Error("Invalid encrypted PII payload format.");
  }
  const [ivB64, tagB64, dataB64] = parts;
  const decipher = crypto.createDecipheriv(AES_ALGO, key, Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(dataB64, "base64")),
    decipher.final(),
  ]);
  return decrypted.toString("utf8");
}

/**
 * Computes a deterministic HMAC-SHA256 blind index for exact duplicate/lookup checks
 * without storing plaintext PII in searchable DB columns.
 */
export function computePiiBlindIndex(value: string, base64HmacKey: string): string {
  const key = decodeKey(base64HmacKey, "PII_HMAC_KEY_BASE64");
  return crypto
    .createHmac("sha256", key)
    .update(value.trim().toUpperCase())
    .digest("hex");
}

/**
 * Masks sensitive strings for default UI display (e.g. "072099001234" -> "********1234").
 */
export function maskSensitiveValue(value: string | null | undefined, visibleTail = 4): string {
  if (!value) return "—";
  const trimmed = value.trim();
  if (trimmed.length <= visibleTail) return "*".repeat(trimmed.length);
  return `${"*".repeat(trimmed.length - visibleTail)}${trimmed.slice(-visibleTail)}`;
}

