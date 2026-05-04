import { Editor } from "../../editor/components/Editor";

// Bookmarkable editor URL: /edit/<slug> opens the saved page directly,
// auto-loading its editor_state from the backend. The slug is whatever
// the SaveModal returned on the last save (or what the user typed in
// the slug input on first save).

export default async function EditPage({
  params,
}: {
  // Next 16 ships `params` as a Promise — this is intentional, see
  // node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/dynamic-routes.md.
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return <Editor slug={slug} />;
}
