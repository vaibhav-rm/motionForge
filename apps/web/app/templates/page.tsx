import { AppShell } from "@/components/app-shell";
import { TemplatesClient } from "@/components/templates-client";

export const dynamic = "force-dynamic";

export default function TemplatesPage() {
  return (
    <AppShell
      title="Templates"
      subtitle="Prompt-driven starting points for your next video"
    >
      <TemplatesClient />
    </AppShell>
  );
}
