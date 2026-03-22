import { normalizeText } from "../../common/utils/tabular.utils";

export type DictionaryLookupItem = {
  code: string;
  name?: string | null;
  value?: string | null;
};

export function toLookupKey(value: string): string {
  return normalizeText(value).toLowerCase();
}

export function resolveDictionaryCodeByText(
  codeByLookup: Map<string, string>,
  text: string,
): string | undefined {
  const key = toLookupKey(text);
  if (!key) return undefined;
  return codeByLookup.get(key);
}

export function registerDictionaryLookup(
  codeByLookup: Map<string, string>,
  item: DictionaryLookupItem,
) {
  const candidates = [item.code, item.name || "", item.value || ""];
  candidates.forEach((value) => {
    const key = toLookupKey(value);
    if (key) {
      codeByLookup.set(key, item.code);
    }
  });
}

export function toImportErrors(
  raw: unknown,
): Array<{ row: number; message: string }> {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => ({
      row: Number((item as any)?.row || 0),
      message: String((item as any)?.message || ""),
    }))
    .filter((item) => item.row > 0 && item.message);
}
