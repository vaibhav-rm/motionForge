import { AppShell } from "@/components/app-shell";

export const dynamic = "force-dynamic";
import { EmptyState } from "@/components/ui";
import { Image as ImageIcon } from "lucide-react";

export default function AssetsPage() {
  return (
    <AppShell title="Assets Library">
      <div className="p-6">
        <EmptyState
          icon={<ImageIcon size={20} />}
          title="Project assets"
          description="Assets are managed per project. Open a project to upload images, audio, video, and SVGs, then use them in your scenes."
        />
      </div>
    </AppShell>
  );
}
