import {
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  getPasswordPolicyError,
} from "./password-policy.utils";

describe("password-policy.utils", () => {
  it("should accept a strong password", () => {
    expect(getPasswordPolicyError("Strong@123")).toBeNull();
  });

  it("should reject short password", () => {
    expect(getPasswordPolicyError("Aa1!")).toBe(
      `密码长度至少为 ${PASSWORD_MIN_LENGTH} 位`,
    );
  });

  it("should reject too long password", () => {
    const longPassword = `Aa1!${"x".repeat(PASSWORD_MAX_LENGTH)}`;
    expect(getPasswordPolicyError(longPassword)).toBe(
      `密码长度不能超过 ${PASSWORD_MAX_LENGTH} 位`,
    );
  });

  it("should reject password without special char", () => {
    expect(getPasswordPolicyError("Abcdefg1")).toBe(
      "密码必须包含大小写字母、数字和特殊字符",
    );
  });

  it("should reject common weak password", () => {
    expect(getPasswordPolicyError("password123")).toBe(
      "密码过于常见，请更换更安全的密码",
    );
  });
});
