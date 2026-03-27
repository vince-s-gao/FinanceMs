import { describe, expect, it } from "vitest";
import {
  getTaxRateDisplay,
  parseCurrencyInput,
  resolveAttachmentUrl,
  resolveDirectionByContractType,
} from "./utils";

describe("invoice utils", () => {
  it("resolveDirectionByContractType should map SALES/销售 to OUTBOUND", () => {
    expect(resolveDirectionByContractType("SALES")).toBe("OUTBOUND");
    expect(resolveDirectionByContractType("销售合同")).toBe("OUTBOUND");
    expect(resolveDirectionByContractType("purchase")).toBe("INBOUND");
    expect(resolveDirectionByContractType(undefined)).toBe("INBOUND");
  });

  it("resolveAttachmentUrl should keep absolute url and normalize relative path", () => {
    expect(resolveAttachmentUrl("https://example.com/a.pdf")).toBe(
      "https://example.com/a.pdf",
    );
    expect(resolveAttachmentUrl("uploads/a.pdf")).toBe(
      "http://localhost:3001/uploads/a.pdf",
    );
    expect(resolveAttachmentUrl("/uploads/b.pdf")).toBe(
      "http://localhost:3001/uploads/b.pdf",
    );
  });

  it("getTaxRateDisplay should return formatted rate", () => {
    expect(getTaxRateDisplay(113, 13)).toBe("13.00%");
    expect(getTaxRateDisplay(100, 0)).toBe("0.00%");
    expect(getTaxRateDisplay(0, 1)).toBe("-");
    expect(getTaxRateDisplay(100, -1)).toBe("-");
  });

  it("parseCurrencyInput should strip currency symbol and separators", () => {
    expect(parseCurrencyInput("¥12,345.67")).toBe("12345.67");
    expect(parseCurrencyInput(123)).toBe("123");
    expect(parseCurrencyInput("")).toBe("");
  });
});
