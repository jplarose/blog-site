import type { Category, PostStatus } from "@/lib/api";

const STATUS_OPTIONS: Array<PostStatus | "All"> = ["All", "Draft", "Scheduled", "Published", "Archived"];

interface PostListFiltersProps {
  status: PostStatus | "All";
  categoryId: string;
  categories: Category[];
  onStatusChange: (status: PostStatus | "All") => void;
  onCategoryChange: (categoryId: string) => void;
}

/** Status tabs and category dropdown that drive the post list query. */
export default function PostListFilters({
  status,
  categoryId,
  categories,
  onStatusChange,
  onCategoryChange,
}: PostListFiltersProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div role="tablist" aria-label="Filter posts by status" className="flex gap-2 border-b border-gray-200">
        {STATUS_OPTIONS.map((option) => (
          <button
            key={option}
            type="button"
            role="tab"
            aria-selected={status === option}
            onClick={() => onStatusChange(option)}
            className="px-4 py-2 text-sm font-medium text-gray-500 border-b-2 border-transparent hover:text-gray-700 hover:border-gray-300 transition-colors aria-selected:text-indigo-600 aria-selected:border-indigo-600"
          >
            {option}
          </button>
        ))}
      </div>

      <label className="flex items-center gap-2 text-sm text-gray-600">
        Category
        <select
          value={categoryId}
          onChange={(event) => onCategoryChange(event.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        >
          <option value="">All categories</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
