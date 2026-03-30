export function isFormValidationError(error: unknown): boolean {
  return typeof error === "object" && error !== null && "errorFields" in error;
}

export function buildKeywordTypeParams(
  keyword?: string,
  type?: string,
): Record<string, unknown> {
  const params: Record<string, unknown> = {};
  const normalizedKeyword = keyword?.trim();
  if (normalizedKeyword) {
    params.keyword = normalizedKeyword;
  }
  if (type) {
    params.type = type;
  }
  return params;
}
