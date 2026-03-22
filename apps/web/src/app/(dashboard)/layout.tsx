// InfFinanceMs - Dashboard布局

import MainLayout from '@/components/layout/MainLayout';
import AppErrorBoundary from '@/components/common/AppErrorBoundary';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <MainLayout>
      <AppErrorBoundary>{children}</AppErrorBoundary>
    </MainLayout>
  );
}
