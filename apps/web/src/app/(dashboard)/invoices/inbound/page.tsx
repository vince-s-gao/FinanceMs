import { redirect } from "next/navigation";

export default function InboundInvoicesPage() {
  redirect("/invoices?tab=inbound");
}
