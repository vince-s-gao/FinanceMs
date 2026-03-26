import { decryptIfNeeded, encryptNullable } from "./encryption.utils";

export function buildSensitiveFieldEqualsOr(
  fieldName: string,
  value: string,
): Array<Record<string, string>> {
  const encrypted = encryptNullable(value);
  if (!encrypted) return [{ [fieldName]: value }];
  return [{ [fieldName]: encrypted }, { [fieldName]: value }];
}

export function isSensitiveFieldChanged(
  incomingPlainValue: string | null | undefined,
  storedValue: string | null | undefined,
): boolean {
  const incoming = incomingPlainValue || null;
  const stored = decryptIfNeeded(storedValue);
  return incoming !== stored;
}
