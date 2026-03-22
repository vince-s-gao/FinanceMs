import { redirect } from "next/navigation";

export default function OutboundInvoicesPage() {
  redirect("/invoices?tab=outbound");
}
