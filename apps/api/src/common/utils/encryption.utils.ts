import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
} from "crypto";

const ENCRYPTION_PREFIX = "enc:v1:";
const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;

let cachedKey: Buffer | null = null;

function getEncryptionKey(): Buffer {
  if (cachedKey) return cachedKey;
  const source =
    process.env.ENCRYPTION_KEY?.trim() || "dev-only-encryption-key-change-me";
  cachedKey = createHash("sha256").update(source).digest();
  return cachedKey;
}

function toDeterministicIv(plainText: string): Buffer {
  return createHmac("sha256", getEncryptionKey())
    .update(plainText)
    .digest()
    .subarray(0, IV_LENGTH);
}

export function isEncryptedValue(value?: string | null): boolean {
  return typeof value === "string" && value.startsWith(ENCRYPTION_PREFIX);
}

export function encryptDeterministic(plainText: string): string {
  if (!plainText) return plainText;
  if (isEncryptedValue(plainText)) return plainText;

  const iv = toDeterministicIv(plainText);
  const cipher = createCipheriv(ALGORITHM, getEncryptionKey(), iv);
  const encrypted = Buffer.concat([
    cipher.update(plainText, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  return `${ENCRYPTION_PREFIX}${iv.toString("hex")}:${tag.toString("hex")}:${encrypted.toString("hex")}`;
}

export function decryptIfNeeded(value?: string | null): string | null {
  if (!value) return null;
  if (!isEncryptedValue(value)) return value;

  const payload = value.slice(ENCRYPTION_PREFIX.length);
  const parts = payload.split(":");
  if (parts.length !== 3) return value;

  const [ivHex, tagHex, encryptedHex] = parts;
  try {
    const decipher = createDecipheriv(
      ALGORITHM,
      getEncryptionKey(),
      Buffer.from(ivHex, "hex"),
    );
    decipher.setAuthTag(Buffer.from(tagHex, "hex"));
    const plainText = Buffer.concat([
      decipher.update(Buffer.from(encryptedHex, "hex")),
      decipher.final(),
    ]).toString("utf8");
    return plainText;
  } catch {
    // 历史脏数据或密钥切换时保持可读性，原样返回避免接口整体失败
    return value;
  }
}

export function encryptNullable(value?: string | null): string | null {
  if (!value) return null;
  return encryptDeterministic(value);
}
