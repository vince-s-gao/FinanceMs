import { describe, expect, it } from "vitest";
import { buildKeywordTypeParams, isFormValidationError } from "./form";

describe("form utils", () => {
  it("isFormValidationError should detect antd form validation error shape", () => {
    expect(isFormValidationError({ errorFields: [] })).toBe(true);
    expect(isFormValidationError({})).toBe(false);
    expect(isFormValidationError(null)).toBe(false);
    expect(isFormValidationError("err")).toBe(false);
  });

  it("buildKeywordTypeParams should normalize keyword and include type", () => {
    expect(buildKeywordTypeParams("  abc  ", "ENTERPRISE")).toEqual({
      keyword: "abc",
      type: "ENTERPRISE",
    });
    expect(buildKeywordTypeParams("   ", "ENTERPRISE")).toEqual({
      type: "ENTERPRISE",
    });
    expect(buildKeywordTypeParams(" hello ", undefined)).toEqual({
      keyword: "hello",
    });
    expect(buildKeywordTypeParams(undefined, undefined)).toEqual({});
  });
});
