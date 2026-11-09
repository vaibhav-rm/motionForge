import { EditorClient } from "@/components/editor/editor-client";

export const dynamic = "force-dynamic";

export default async function EditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <EditorClient projectId={id} />;
}
