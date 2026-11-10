import { AppShell } from "@/components/app-shell";
import { DashboardClient } from "@/components/dashboard-client";

export const dynamic = "force-dynamic";

export default function ProjectsPage() {
  return (
    <AppShell title="My Projects" subtitle="Everything you have created">
      <DashboardClient showComposer={false} />
    </AppShell>
  );
}
