"use client";

import { useMemo } from "react";
import { Tabs, Typography } from "antd";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import InvoiceManagementPage from "@/components/invoices/InvoiceManagementPage";

const { Title } = Typography;

type InvoiceTabKey = "inbound" | "outbound";

export default function InvoicesPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const activeTab = useMemo<InvoiceTabKey>(() => {
    const raw = searchParams.get("tab");
    return raw === "outbound" ? "outbound" : "inbound";
  }, [searchParams]);

  return (
    <div>
      <Title level={4}>发票管理</Title>

      <Tabs
        className="mt-4"
        activeKey={activeTab}
        onChange={(nextKey) => {
          const key = nextKey === "outbound" ? "outbound" : "inbound";
          const next = `${pathname}?tab=${key}`;
          router.replace(next, { scroll: false });
        }}
        items={[
          {
            key: "inbound",
            label: "进项发票",
            children: (
              <InvoiceManagementPage fixedDirection="INBOUND" hidePageTitle />
            ),
          },
          {
            key: "outbound",
            label: "出项发票",
            children: (
              <InvoiceManagementPage fixedDirection="OUTBOUND" hidePageTitle />
            ),
          },
        ]}
      />
    </div>
  );
}
