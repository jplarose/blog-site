import {
  axisTicks,
  barGeometry,
  formatUtcDateLabel,
  isAllZeroSeries,
  niceAxisMax,
  sparseTickIndices,
  type DailyViewPoint,
} from "@/lib/dashboard/chartMath";

interface DailyViewsChartProps {
  dailyViews: DailyViewPoint[];
  /** Compact mode is used on the dashboard summary; the analytics page uses the full size. */
  compact?: boolean;
}

const ACCENT_COLOR = "#6366f1"; // indigo-500 — matches the admin's existing primary accent.
const GRID_COLOR = "#e5e7eb"; // gray-200
const AXIS_TEXT_COLOR = "#9ca3af"; // gray-400

const PLOT_WIDTH = 600;
const AXIS_LABEL_HEIGHT = 20;
const Y_AXIS_WIDTH = 32;

function buildAriaLabel(dailyViews: DailyViewPoint[]): string {
  if (dailyViews.length === 0) return "Daily page views chart with no data.";

  const total = dailyViews.reduce((sum, point) => sum + point.viewCount, 0);
  if (total === 0) {
    return `Daily page views for ${dailyViews.length} days, all zero — no traffic in this period.`;
  }

  const peak = dailyViews.reduce((max, point) => (point.viewCount > max.viewCount ? point : max));
  const first = dailyViews[0];
  const last = dailyViews[dailyViews.length - 1];
  return (
    `Daily page views from ${formatUtcDateLabel(first.date)} to ${formatUtcDateLabel(last.date)}, ` +
    `totaling ${total} views. Peak of ${peak.viewCount} views on ${formatUtcDateLabel(peak.date)}.`
  );
}

/**
 * Inline SVG bar chart for the analytics contract's `dailyViews` series.
 * No charting library: bar geometry and axis ticks come from the pure
 * `lib/dashboard/chartMath` module so they're independently unit tested.
 *
 * Accessible by three layers: `role="img"` with a summarizing `aria-label`
 * for a quick screen-reader announcement, a `<title>`/`<desc>` pair for
 * tooltip/SVG-AT support, and a visually-hidden `<table>` fallback with the
 * exact per-day values for anyone who wants the raw numbers.
 */
export default function DailyViewsChart({ dailyViews, compact = false }: DailyViewsChartProps) {
  const plotHeight = compact ? 120 : 220;
  const maxViewCount = dailyViews.reduce((max, point) => Math.max(max, point.viewCount), 0);
  const axisMax = niceAxisMax(maxViewCount);
  const ticks = axisTicks(axisMax, compact ? 2 : 4);
  const allZero = isAllZeroSeries(dailyViews);

  const barAreaWidth = PLOT_WIDTH - Y_AXIS_WIDTH;
  const bars = barGeometry(dailyViews, axisMax, {
    width: barAreaWidth,
    height: plotHeight,
    barGapRatio: 0.3,
  });

  const tickLabelIndices = new Set(
    sparseTickIndices(dailyViews.length, compact ? 10 : 6),
  );

  const totalHeight = plotHeight + AXIS_LABEL_HEIGHT;
  const ariaLabel = buildAriaLabel(dailyViews);

  return (
    <div>
      <svg
        role="img"
        aria-label={ariaLabel}
        viewBox={`0 0 ${PLOT_WIDTH} ${totalHeight}`}
        className="w-full"
        preserveAspectRatio="xMidYMid meet"
      >
        <title>Daily page views</title>
        <desc>{ariaLabel}</desc>

        <g transform={`translate(${Y_AXIS_WIDTH}, 0)`}>
          {/* Muted horizontal gridlines at each y-axis tick. */}
          {ticks.map((tick) => {
            const y = plotHeight - (tick / axisMax) * plotHeight;
            return (
              <line
                key={tick}
                x1={0}
                x2={barAreaWidth}
                y1={y}
                y2={y}
                stroke={GRID_COLOR}
                strokeWidth={1}
              />
            );
          })}

          {bars.map((bar) => (
            <rect
              key={bar.date}
              x={bar.x}
              y={bar.y}
              width={bar.width}
              height={bar.height}
              fill={ACCENT_COLOR}
              rx={1}
            />
          ))}

          {/* Sparse x-axis date labels (~weekly) so 30 points don't crowd the axis. */}
          {dailyViews.map((point, index) =>
            tickLabelIndices.has(index) ? (
              <text
                key={point.date}
                x={index * (barAreaWidth / dailyViews.length) + barAreaWidth / dailyViews.length / 2}
                y={plotHeight + 14}
                textAnchor="middle"
                fontSize={10}
                fill={AXIS_TEXT_COLOR}
              >
                {formatUtcDateLabel(point.date)}
              </text>
            ) : null,
          )}
        </g>

        {/* Y-axis tick labels. */}
        {ticks.map((tick) => {
          const y = plotHeight - (tick / axisMax) * plotHeight;
          return (
            <text
              key={tick}
              x={Y_AXIS_WIDTH - 6}
              y={y + 3}
              textAnchor="end"
              fontSize={10}
              fill={AXIS_TEXT_COLOR}
            >
              {tick}
            </text>
          );
        })}
      </svg>

      {allZero ? (
        <p className="mt-2 text-center text-sm text-gray-400">No views in this period.</p>
      ) : null}

      <table className="sr-only">
        <caption>Daily page views</caption>
        <thead>
          <tr>
            <th scope="col">Date</th>
            <th scope="col">Views</th>
          </tr>
        </thead>
        <tbody>
          {dailyViews.map((point) => (
            <tr key={point.date}>
              <td>{point.date}</td>
              <td>{point.viewCount}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
