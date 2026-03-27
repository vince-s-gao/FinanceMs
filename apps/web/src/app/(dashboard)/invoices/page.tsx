"use client";

import { useEffect, useMemo } from "react";
import { Tabs, Typography, message } from "antd";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import InvoiceManagementPage from "@/components/invoices/InvoiceManagementPage";
import { useFunctionPermissions } from "@/hooks/useFunctionPermissions";

const { Title } = Typography;

type InvoiceTabKey = "inbound" | "outbound";

export default function InvoicesPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { loaded, has } = useFunctionPermissions();
  const canView = has("invoice.view");

  useEffect(() => {
    if (!loaded) return;
    if (!canView) {
      message.warning("当前账号没有查看发票权限");
      router.replace("/dashboard");
    }
  }, [canView, loaded, router]);

  const activeTab = useMemo<InvoiceTabKey>(() => {
    const raw = searchParams.get("tab");
    return raw === "outbound" ? "outbound" : "inbound";
  }, [searchParams]);

  if (loaded && !canView) {
    return null;
  }

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
