function pluralize(word: string): string {
  return word.endsWith("y") ? `${word.slice(0, -1)}ies` : `${word}s`;
}

export interface TaxonomyRow {
  id: number;
  name: string;
  slug: string;
  postCount: number;
  description?: string;
}

interface TaxonomyTableProps {
  /** Lowercase singular noun used in copy, e.g. "category" or "tag". */
  entityLabel: string;
  rows: TaxonomyRow[];
  isLoading: boolean;
  showDescription: boolean;
  onEdit: (row: TaxonomyRow) => void;
  onDelete: (row: TaxonomyRow) => void;
}

/** Shared category/tag list table: loading skeleton, empty state, and populated rows. */
export default function TaxonomyTable({
  entityLabel,
  rows,
  isLoading,
  showDescription,
  onEdit,
  onDelete,
}: TaxonomyTableProps) {
  const columnCount = showDescription ? 5 : 4;
  const pluralLabel = pluralize(entityLabel);

  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Name</th>
            <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Slug</th>
            {showDescription ? (
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Description
              </th>
            ) : null}
            <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Posts</th>
            <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {isLoading ? (
            <tr>
              <td colSpan={columnCount} className="px-6 py-10 text-center text-sm text-gray-400">
                Loading {pluralLabel}…
              </td>
            </tr>
          ) : rows.length === 0 ? (
            <tr>
              <td colSpan={columnCount} className="px-6 py-10 text-center text-sm text-gray-400">
                No {pluralLabel} yet. Create your first one.
              </td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr key={row.id}>
                <td className="px-6 py-4 text-sm font-medium text-gray-900">{row.name}</td>
                <td className="px-6 py-4 text-sm text-gray-500">{row.slug}</td>
                {showDescription ? (
                  <td className="px-6 py-4 text-sm text-gray-500">{row.description || "—"}</td>
                ) : null}
                <td className="px-6 py-4 text-sm text-gray-500">{row.postCount}</td>
                <td className="px-6 py-4">
                  <div className="flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => onEdit(row)}
                      className="rounded-md border border-gray-300 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => onDelete(row)}
                      className="rounded-md border border-rose-200 px-2 py-1 text-xs font-medium text-rose-700 hover:bg-rose-50"
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
