import type { Tag } from "@/lib/api";

interface TagSelectorProps {
  tags: Tag[];
  selectedTagIds: number[];
  onToggle: (tagId: number) => void;
  disabled?: boolean;
}

/**
 * Multi-select of managed tags (issue #38 owns tag creation/editing; this
 * editor only lets the owner attach existing tags to a post).
 */
export default function TagSelector({ tags, selectedTagIds, onToggle, disabled = false }: TagSelectorProps) {
  if (tags.length === 0) {
    return <p className="text-sm text-gray-500">No tags available yet.</p>;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {tags.map((tag) => {
        const isSelected = selectedTagIds.includes(tag.id);

        return (
          <label
            key={tag.id}
            className={`cursor-pointer rounded-full border px-3 py-1 text-sm transition-colors ${
              disabled ? "cursor-not-allowed opacity-60" : ""
            } ${
              isSelected
                ? "border-indigo-600 bg-indigo-50 text-indigo-700"
                : "border-gray-300 bg-white text-gray-600 hover:border-gray-400"
            }`}
          >
            <input
              type="checkbox"
              checked={isSelected}
              onChange={() => onToggle(tag.id)}
              disabled={disabled}
              className="sr-only"
            />
            {tag.name}
          </label>
        );
      })}
    </div>
  );
}
