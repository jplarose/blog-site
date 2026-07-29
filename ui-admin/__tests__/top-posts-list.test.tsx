import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import TopPostsList from "@/components/dashboard/TopPostsList";
import type { AnalyticsSummary } from "@/lib/api";

describe("TopPostsList", () => {
  afterEach(() => cleanup());

  it("links each post to its admin editor and shows the view count", () => {
    const topPosts: AnalyticsSummary["topPosts"] = [
      { postId: 42, title: "Hello World", slug: "hello-world", viewCount: 108 },
    ];

    render(<TopPostsList topPosts={topPosts} />);

    const link = screen.getByRole("link", { name: "Hello World" });
    expect(link).toHaveAttribute("href", "/posts/42");
    expect(screen.getByText("108")).toBeInTheDocument();
  });

  it("shows an empty state when there are no top posts", () => {
    render(<TopPostsList topPosts={[]} />);

    expect(screen.getByText(/no views yet/i)).toBeInTheDocument();
  });
});
