import { AppShell } from "@/components/app-shell";
import { SettingsClient } from "@/components/settings-client";

export const dynamic = "force-dynamic";

export default function SettingsPage() {
  return (
    <AppShell title="Settings" subtitle="Providers · defaults · rendering">
      <SettingsClient />
    </AppShell>
  );
}
