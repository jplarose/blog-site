"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import PaginationControls from "@/components/posts/PaginationControls";
import PostListFilters from "@/components/posts/PostListFilters";
import PostListTable from "@/components/posts/PostListTable";
import { categoriesApi, postsApi, type Category, type Post, type PostStatus, type PostSummary } from "@/lib/api";

const PAGE_SIZE = 20;

function buildListParams(status: PostStatus | "All", categoryId: string, page: number) {
  const params: Record<string, string> = {
    page: String(page),
    pageSize: String(PAGE_SIZE),
  };
  if (status !== "All") params.status = status;
  if (categoryId) params.categoryId = categoryId;
  return params;
}

export default function PostsPage() {
  const [status, setStatus] = useState<PostStatus | "All">("All");
  const [categoryId, setCategoryId] = useState("");
  const [page, setPage] = useState(1);
  const [posts, setPosts] = useState<PostSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  useEffect(() => {
    let isActive = true;
    categoriesApi
      .list()
      .then((result) => {
        if (isActive) setCategories(result);
      })
      .catch((error) => {
        if (!isActive) return;
        // The category filter is a convenience on top of the post list, so a
        // failure here shouldn't block the page — but it must still be
        // surfaced rather than silently leaving the filter empty.
        setActionMessage(
          error instanceof Error
            ? `Category filter unavailable: ${error.message}`
            : "Category filter unavailable.",
        );
      });
    return () => {
      isActive = false;
    };
  }, []);

  useEffect(() => {
    let isActive = true;

    async function loadPosts() {
      setIsLoading(true);
      setListError(null);

      try {
        const result = await postsApi.list(buildListParams(status, categoryId, page));
        if (!isActive) return;
        setPosts(result.items);
        setTotal(result.total);
      } catch (error) {
        if (!isActive) return;
        setPosts([]);
        setTotal(0);
        setListError(error instanceof Error ? error.message : "Failed to load posts.");
      } finally {
        if (isActive) setIsLoading(false);
      }
    }

    void loadPosts();

    return () => {
      isActive = false;
    };
  }, [status, categoryId, page]);

  function handleStatusChange(nextStatus: PostStatus | "All") {
    setStatus(nextStatus);
    setPage(1);
  }

  function handleCategoryChange(nextCategoryId: string) {
    setCategoryId(nextCategoryId);
    setPage(1);
  }

  function handlePostChanged(updatedPost: Post) {
    setPosts((currentPosts) =>
      currentPosts.map((post) => (post.id === updatedPost.id ? { ...post, ...updatedPost } : post)),
    );
    setActionMessage(`"${updatedPost.title}" is now ${updatedPost.status}.`);
  }

  function handlePostDeleted(postId: number) {
    setPosts((currentPosts) => currentPosts.filter((post) => post.id !== postId));
    setTotal((currentTotal) => Math.max(0, currentTotal - 1));
    setActionMessage("Post deleted.");
  }

  function handleRowError(message: string) {
    setActionMessage(message);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Posts</h1>
          <p className="mt-1 text-sm text-gray-500">Manage your blog posts</p>
        </div>
        <Link
          href="/posts/new"
          className="inline-flex items-center rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 transition-colors"
        >
          + New Post
        </Link>
      </div>

      <PostListFilters
        status={status}
        categoryId={categoryId}
        categories={categories}
        onStatusChange={handleStatusChange}
        onCategoryChange={handleCategoryChange}
      />

      <div aria-live="polite" className="sr-only">
        {actionMessage}
      </div>

      {actionMessage ? (
        <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700">
          {actionMessage}
        </div>
      ) : null}

      {listError ? (
        <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {listError}
        </div>
      ) : (
        <PostListTable
          posts={posts}
          isLoading={isLoading}
          onChanged={handlePostChanged}
          onDeleted={handlePostDeleted}
          onRowError={handleRowError}
        />
      )}

      <PaginationControls page={page} pageSize={PAGE_SIZE} total={total} onPageChange={setPage} />
    </div>
  );
}
