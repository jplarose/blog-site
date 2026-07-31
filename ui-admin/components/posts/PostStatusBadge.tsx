import type { PostStatus } from "@/lib/api";

const STATUS_STYLES: Record<PostStatus, string> = {
  Draft: "bg-gray-100 text-gray-700",
  Scheduled: "bg-amber-100 text-amber-800",
  Published: "bg-emerald-100 text-emerald-800",
  Archived: "bg-slate-200 text-slate-600",
};

export default function PostStatusBadge({ status }: { status: PostStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLES[status]}`}
    >
      {status}
    </span>
  );
}
