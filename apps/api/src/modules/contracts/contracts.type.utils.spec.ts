import { isSalesContractType } from "./contracts.type.utils";

describe("contracts.type.utils", () => {
  it("should identify sales contract types", () => {
    expect(isSalesContractType(["SALES"])).toBe(true);
    expect(isSalesContractType(["销售合同"])).toBe(true);
    expect(isSalesContractType(["receivable"])).toBe(true);
  });

  it("should exclude non-sales types even if mixed with noisy text", () => {
    expect(isSalesContractType(["NDA"])).toBe(false);
    expect(isSalesContractType(["销售保密协议"])).toBe(false);
    expect(isSalesContractType(["Confidential Agreement"])).toBe(false);
    expect(isSalesContractType(["采购合同"])).toBe(false);
    expect(isSalesContractType(["OTHER"])).toBe(false);
    expect(isSalesContractType(["TS"])).toBe(false);
    expect(isSalesContractType(["FA"])).toBe(false);
  });
});
