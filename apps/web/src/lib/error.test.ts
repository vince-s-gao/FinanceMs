import { describe, expect, it } from "vitest";
import { ERROR_CODE } from "@inffinancems/shared";
import { getErrorMessage } from "@/lib/error";

describe("getErrorMessage", () => {
  it("should map known error code to friendly message", () => {
    expect(getErrorMessage({ code: ERROR_CODE.AUTH_INVALID_CREDENTIALS })).toBe(
      "账号或密码错误，请重试",
    );
  });

  it("should fallback to backend message when code is unknown", () => {
    expect(getErrorMessage({ message: "后端自定义错误" })).toBe(
      "后端自定义错误",
    );
  });

  it("should use default fallback when error is empty", () => {
    expect(getErrorMessage(null)).toBe("操作失败，请稍后重试");
  });
});
