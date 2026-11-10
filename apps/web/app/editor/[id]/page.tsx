import { EditorClient } from "@/components/editor/editor-client";
import { loadSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

export default async function EditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const settings = await loadSettings();
  return (
    <EditorClient projectId={id} defaultQuality={settings.defaults.quality} />
  );
}
