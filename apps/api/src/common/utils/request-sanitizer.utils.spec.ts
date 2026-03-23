import { sanitizeRequestUrl } from "./request-sanitizer.utils";

describe("sanitizeRequestUrl", () => {
  it("should mask sensitive query keys", () => {
    const result = sanitizeRequestUrl(
      "/api/auth/feishu/callback?code=abc123&state=xyz789&from=login",
    );

    expect(result).toContain("/api/auth/feishu/callback?");
    expect(result).toContain("code=***");
    expect(result).toContain("state=***");
    expect(result).toContain("from=login");
  });

  it("should mask token-like values for non-sensitive key", () => {
    const tokenLike = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.long.payload";
    const result = sanitizeRequestUrl(`/api/test?next=${tokenLike}`);
    expect(result).toBe("/api/test?next=***");
  });

  it("should keep plain urls unchanged", () => {
    expect(sanitizeRequestUrl("/api/contracts?page=1&pageSize=20")).toBe(
      "/api/contracts?page=1&pageSize=20",
    );
  });
});
