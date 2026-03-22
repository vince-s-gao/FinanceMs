import { Decimal } from "@prisma/client/runtime/library";

type ContractSummaryInput = {
  amountWithTax: Decimal | number | string;
  paymentRecords: Array<{ amount: Decimal | number | string }>;
  invoices: Array<{ status: string; amount: Decimal | number | string }>;
};

export function buildContractDetailSummary(contract: ContractSummaryInput) {
  const totalPaid = contract.paymentRecords.reduce(
    (sum, record) => sum.plus(record.amount),
    new Decimal(0),
  );

  const totalInvoiced = contract.invoices
    .filter((inv) => inv.status === "ISSUED")
    .reduce((sum, inv) => sum.plus(inv.amount), new Decimal(0));

  const amountWithTaxDecimal = new Decimal(contract.amountWithTax.toString());

  return {
    totalPaid,
    receivable: amountWithTaxDecimal.minus(totalPaid),
    totalInvoiced,
    uninvoiced: totalPaid.minus(totalInvoiced),
    paymentProgress: totalPaid.div(amountWithTaxDecimal).times(100).toFixed(2),
  };
}
