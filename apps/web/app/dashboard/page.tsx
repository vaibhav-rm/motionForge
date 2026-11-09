import { AppShell } from "@/components/app-shell";
import { DashboardClient } from "@/components/dashboard-client";

export const dynamic = "force-dynamic";

export default function DashboardPage() {
  return (
    <AppShell title="Dashboard">
      <DashboardClient />
    </AppShell>
  );
}
