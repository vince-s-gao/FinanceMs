import { createHmac, randomBytes } from "crypto";

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

function base32Encode(buffer: Buffer): string {
  let bits = 0;
  let value = 0;
  let output = "";

  for (const byte of buffer) {
    value = (value << 8) | byte;
    bits += 8;

    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }

  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  }

  return output;
}

function base32Decode(secret: string): Buffer {
  const normalized = secret.replace(/=+$/g, "").toUpperCase();
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];

  for (const char of normalized) {
    const index = BASE32_ALPHABET.indexOf(char);
    if (index === -1) {
      throw new Error("Invalid base32 secret");
    }
    value = (value << 5) | index;
    bits += 5;

    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }

  return Buffer.from(bytes);
}

function generateTotpCode(
  secret: string,
  timestampMs: number,
  stepSeconds = 30,
  digits = 6,
): string {
  const counter = Math.floor(timestampMs / 1000 / stepSeconds);
  const key = base32Decode(secret);
  const counterBuffer = Buffer.alloc(8);
  counterBuffer.writeBigUInt64BE(BigInt(counter));
  const hmac = createHmac("sha1", key).update(counterBuffer).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const binary =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);
  const code = binary % 10 ** digits;
  return String(code).padStart(digits, "0");
}

export function generateTotpSecret(lengthBytes = 20): string {
  return base32Encode(randomBytes(lengthBytes));
}

export function verifyTotpCode(
  secret: string,
  rawCode: string,
  options?: {
    stepSeconds?: number;
    digits?: number;
    window?: number;
    now?: number;
  },
): boolean {
  const code = rawCode.replace(/\s+/g, "");
  if (!/^\d{6}$/.test(code)) return false;

  const stepSeconds = options?.stepSeconds ?? 30;
  const digits = options?.digits ?? 6;
  const window = options?.window ?? 1;
  const now = options?.now ?? Date.now();

  for (let skew = -window; skew <= window; skew += 1) {
    const ts = now + skew * stepSeconds * 1000;
    if (generateTotpCode(secret, ts, stepSeconds, digits) === code) {
      return true;
    }
  }

  return false;
}
