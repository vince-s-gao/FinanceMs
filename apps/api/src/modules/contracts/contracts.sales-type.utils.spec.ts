import {
  isSalesContractByContext,
  resolveSalesContractTypeContext,
} from "./contracts.sales-type.utils";

describe("contracts.sales-type.utils", () => {
  describe("resolveSalesContractTypeContext", () => {
    it("should detect sales by code/value and keep fallback SALES", async () => {
      const prisma = {
        dictionary: {
          findMany: jest.fn().mockResolvedValue([
            { code: "SALES", name: "销售合同", value: "销售" },
            { code: "NDA", name: "销售保密协议", value: "保密" },
            { code: "PURCHASE", name: "采购合同", value: "采购" },
          ]),
        },
      } as any;

      const context = await resolveSalesContractTypeContext({
        prisma,
      });

      expect(context.codes).toEqual(expect.arrayContaining(["SALES"]));
      expect(context.codes).not.toEqual(expect.arrayContaining(["NDA"]));
      expect(prisma.dictionary.findMany).toHaveBeenCalledWith({
        where: { type: "CONTRACT_TYPE", isEnabled: true },
        select: { code: true, name: true, value: true },
      });
    });

    it("should include disabled types when includeDisabled is true", async () => {
      const prisma = {
        dictionary: {
          findMany: jest.fn().mockResolvedValue([]),
        },
      } as any;

      await resolveSalesContractTypeContext({
        prisma,
        includeDisabled: true,
      });

      expect(prisma.dictionary.findMany).toHaveBeenCalledWith({
        where: { type: "CONTRACT_TYPE" },
        select: { code: true, name: true, value: true },
      });
    });
  });

  describe("isSalesContractByContext", () => {
    it("should match direct code", () => {
      const result = isSalesContractByContext({
        contractType: "SALES",
        context: {
          codes: ["SALES"],
          codeByLookup: new Map(),
        },
      });
      expect(result).toBe(true);
    });

    it("should match by lookup-mapped text", () => {
      const result = isSalesContractByContext({
        contractType: "销售合同",
        context: {
          codes: ["SALES"],
          codeByLookup: new Map([["销售合同", "SALES"]]),
        },
      });
      expect(result).toBe(true);
    });

    it("should return false for non-sales type", () => {
      const result = isSalesContractByContext({
        contractType: "NDA",
        context: {
          codes: ["SALES"],
          codeByLookup: new Map([["NDA", "NDA"]]),
        },
      });
      expect(result).toBe(false);
    });

    it("should keep NDA-like text as non-sales even when lookup points to SALES", () => {
      const result = isSalesContractByContext({
        contractType: "销售保密协议NDA",
        context: {
          codes: ["SALES"],
          codeByLookup: new Map([["销售保密协议nda", "SALES"]]),
        },
      });
      expect(result).toBe(false);
    });
  });
});
