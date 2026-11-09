import { AppShell } from "@/components/app-shell";

export const dynamic = "force-dynamic";
import { EmptyState } from "@/components/ui";
import { Sparkles } from "lucide-react";

export default function TemplatesPage() {
  return (
    <AppShell title="Templates">
      <div className="p-6">
        <EmptyState
          icon={<Sparkles size={20} />}
          title="Prompt-driven by design"
          description="MotionForge generates original compositions from your descriptions instead of locking you into templates. Try a prompt like “a 30-second cinematic visualization of a computer network” in any project."
        />
      </div>
    </AppShell>
  );
}
