export default function AnalyticsPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>
        <p className="mt-1 text-sm text-gray-500">Site traffic and post performance</p>
      </div>

      {/* Date range selector */}
      <div className="flex gap-2">
        {["7d", "30d", "90d", "1y"].map((range) => (
          <button
            key={range}
            className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-colors data-[active=true]:bg-indigo-50 data-[active=true]:border-indigo-300 data-[active=true]:text-indigo-700"
            data-active={range === "30d"}
          >
            {range}
          </button>
        ))}
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Total Page Views", value: "—" },
          { label: "Unique Visitors", value: "—" },
          { label: "Published Posts", value: "—" },
          { label: "Draft Posts", value: "—" },
        ].map(({ label, value }) => (
          <div
            key={label}
            className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm"
          >
            <p className="text-sm text-gray-500">{label}</p>
            <p className="mt-1 text-3xl font-semibold text-gray-900">{value}</p>
          </div>
        ))}
      </div>

      {/* Daily views chart placeholder */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-6">
        <h2 className="text-base font-semibold text-gray-700 mb-4">Daily Page Views</h2>
        <div className="h-48 flex items-center justify-center text-gray-400 text-sm border border-dashed border-gray-200 rounded-lg">
          Chart renders here once connected to the API
        </div>
      </div>

      {/* Top posts */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-base font-semibold text-gray-700">Top Posts</h2>
        </div>
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Post</th>
              <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Views</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            <tr>
              <td colSpan={2} className="px-6 py-8 text-center text-sm text-gray-400">
                No data yet — views will appear once the API is connected.
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
