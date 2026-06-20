import PostEditorForm from "@/components/post-editor/PostEditorForm";
import { postsApi } from "@/lib/api";

export default async function EditPostPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const post = await postsApi.get(Number(id));

  return <PostEditorForm mode="edit" postId={post.id} initialPost={post} />;
}
