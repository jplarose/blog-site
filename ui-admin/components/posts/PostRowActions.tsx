"use client";

import { useState } from "react";
import Link from "next/link";

import ConfirmDeleteDialog from "@/components/posts/ConfirmDeleteDialog";
import ScheduleDialog from "@/components/posts/ScheduleDialog";
import { ApiError, postsApi, type Post, type PostSummary } from "@/lib/api";

interface PostRowActionsProps {
  post: PostSummary;
  onChanged: (updatedPost: Post) => void;
  onDeleted: (postId: number) => void;
  onError: (message: string) => void;
}

type DialogState = "none" | "schedule" | "delete";

function friendlyErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError) {
    return error.status === 400 || error.status === 409
      ? error.message.replace(/^API error \d+: /, "") || fallback
      : fallback;
  }
  return error instanceof Error ? error.message : fallback;
}

/** Row-scoped lifecycle actions: publish, schedule, archive, delete. */
export default function PostRowActions({ post, onChanged, onDeleted, onError }: PostRowActionsProps) {
  const [dialog, setDialog] = useState<DialogState>("none");
  const [isPending, setIsPending] = useState(false);
  const [dialogError, setDialogError] = useState<string | null>(null);

  async function handlePublish() {
    setIsPending(true);
    try {
      const updated = await postsApi.publish(post.id);
      onChanged(updated);
    } catch (error) {
      onError(friendlyErrorMessage(error, "Failed to publish the post."));
    } finally {
      setIsPending(false);
    }
  }

  async function handleArchive() {
    setIsPending(true);
    try {
      const updated = await postsApi.archive(post.id);
      onChanged(updated);
    } catch (error) {
      onError(friendlyErrorMessage(error, "Failed to archive the post."));
    } finally {
      setIsPending(false);
    }
  }

  async function handleScheduleConfirm(scheduledAtIso: string) {
    setIsPending(true);
    setDialogError(null);
    try {
      const updated = await postsApi.schedule(post.id, scheduledAtIso);
      onChanged(updated);
      setDialog("none");
    } catch (error) {
      setDialogError(friendlyErrorMessage(error, "Failed to schedule the post."));
    } finally {
      setIsPending(false);
    }
  }

  async function handleDeleteConfirm() {
    setIsPending(true);
    setDialogError(null);
    try {
      await postsApi.delete(post.id);
      onDeleted(post.id);
      setDialog("none");
    } catch (error) {
      setDialogError(friendlyErrorMessage(error, "Failed to delete the post."));
    } finally {
      setIsPending(false);
    }
  }

  return (
    <div className="flex items-center justify-end gap-2">
      <Link href={`/posts/${post.id}`} className="text-sm text-indigo-600 hover:underline">
        Edit
      </Link>

      {post.status !== "Published" ? (
        <button
          type="button"
          onClick={() => void handlePublish()}
          disabled={isPending}
          className="rounded-md border border-gray-300 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60"
        >
          Publish
        </button>
      ) : null}

      {post.status === "Draft" || post.status === "Scheduled" ? (
        <button
          type="button"
          onClick={() => setDialog("schedule")}
          disabled={isPending}
          className="rounded-md border border-gray-300 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60"
        >
          Schedule
        </button>
      ) : null}

      {post.status !== "Archived" ? (
        <button
          type="button"
          onClick={() => void handleArchive()}
          disabled={isPending}
          className="rounded-md border border-gray-300 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60"
        >
          Archive
        </button>
      ) : null}

      <button
        type="button"
        onClick={() => setDialog("delete")}
        disabled={isPending}
        className="rounded-md border border-rose-200 px-2 py-1 text-xs font-medium text-rose-700 hover:bg-rose-50 disabled:opacity-60"
      >
        Delete
      </button>

      {dialog === "schedule" ? (
        <ScheduleDialog
          postTitle={post.title}
          isSubmitting={isPending}
          serverError={dialogError}
          onCancel={() => {
            setDialog("none");
            setDialogError(null);
          }}
          onConfirm={(iso) => void handleScheduleConfirm(iso)}
        />
      ) : null}

      {dialog === "delete" ? (
        <ConfirmDeleteDialog
          postTitle={post.title}
          isSubmitting={isPending}
          serverError={dialogError}
          onCancel={() => {
            setDialog("none");
            setDialogError(null);
          }}
          onConfirm={() => void handleDeleteConfirm()}
        />
      ) : null}
    </div>
  );
}
