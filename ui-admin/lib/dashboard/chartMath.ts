/**
 * Pure geometry/formatting helpers for the daily-views bar chart.
 *
 * Kept dependency-free (no chart library, no DOM) so the scale/tick/bar math
 * can be unit tested in isolation from rendering. All date handling is UTC —
 * `dailyViews[].date` is a plain "YYYY-MM-DD" string from the analytics
 * contract, and parsing it with the local timezone would shift the label on
 * users west/east of UTC (the classic "off by one day" bug).
 */

export interface DailyViewPoint {
  date: string;
  viewCount: number;
}

export interface ChartBar {
  date: string;
  viewCount: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Rounds a raw maximum up to a "nice" axis ceiling (1/2/5 * 10^n) so tick
 * labels read as round numbers instead of jagged fractions. An all-zero
 * series (max === 0) still gets a positive ceiling so the chart renders a
 * flat baseline rather than collapsing to a zero-height plot.
 */
export function niceAxisMax(maxValue: number): number {
  if (maxValue <= 0) return 4;

  const magnitude = Math.pow(10, Math.floor(Math.log10(maxValue)));
  const normalized = maxValue / magnitude;

  let niceNormalized: number;
  if (normalized <= 1) niceNormalized = 1;
  else if (normalized <= 2) niceNormalized = 2;
  else if (normalized <= 5) niceNormalized = 5;
  else niceNormalized = 10;

  return niceNormalized * magnitude;
}

/**
 * Evenly spaced y-axis ticks from 0 to `axisMax`, inclusive, rounded to
 * whole numbers (view counts are integers, so fractional ticks would be
 * misleading).
 */
export function axisTicks(axisMax: number, tickCount = 4): number[] {
  const count = Math.max(1, tickCount);
  const ticks: number[] = [];
  for (let i = 0; i <= count; i++) {
    ticks.push(Math.round((axisMax * i) / count));
  }
  return ticks;
}

/**
 * Formats a "YYYY-MM-DD" date string as a short deterministic UTC label,
 * e.g. "Jul 5". Deliberately avoids `toLocaleDateString` / the local `Date`
 * constructor so the label never drifts a day depending on the viewer's
 * timezone.
 */
const MONTH_ABBREVIATIONS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
] as const;

export function formatUtcDateLabel(isoDate: string): string {
  const [, monthStr, dayStr] = isoDate.split("-");
  const monthIndex = Number(monthStr) - 1;
  const day = Number(dayStr);
  const monthLabel = MONTH_ABBREVIATIONS[monthIndex] ?? monthStr;
  return `${monthLabel} ${day}`;
}

/**
 * Picks a sparse subset of indices to label on the x-axis so 30 daily
 * points don't render 30 crowded labels. Always includes the first and last
 * point; otherwise spaces labels roughly `intervalDays` apart.
 */
export function sparseTickIndices(pointCount: number, intervalDays = 7): number[] {
  if (pointCount <= 0) return [];
  if (pointCount === 1) return [0];

  const indices = new Set<number>();
  for (let i = 0; i < pointCount; i += intervalDays) {
    indices.add(i);
  }
  indices.add(pointCount - 1);

  return Array.from(indices).sort((a, b) => a - b);
}

export interface BarGeometryOptions {
  width: number;
  height: number;
  barGapRatio?: number;
}

/**
 * Maps daily view counts to pixel-space bar rectangles within a
 * `width` x `height` plot area, scaled against `axisMax` (from
 * `niceAxisMax`). Zero-value bars still get a minimum 1px sliver so the
 * baseline stays visible rather than disappearing entirely.
 */
export function barGeometry(
  dailyViews: DailyViewPoint[],
  axisMax: number,
  { width, height, barGapRatio = 0.3 }: BarGeometryOptions,
): ChartBar[] {
  const count = dailyViews.length;
  if (count === 0 || width <= 0 || height <= 0) return [];

  const slotWidth = width / count;
  const barWidth = slotWidth * (1 - barGapRatio);
  const gapOffset = (slotWidth - barWidth) / 2;
  const safeAxisMax = axisMax > 0 ? axisMax : 1;

  return dailyViews.map((point, index) => {
    const ratio = Math.min(1, Math.max(0, point.viewCount) / safeAxisMax);
    const barHeight = Math.max(1, ratio * height);
    return {
      date: point.date,
      viewCount: point.viewCount,
      x: index * slotWidth + gapOffset,
      y: height - barHeight,
      width: barWidth,
      height: barHeight,
    };
  });
}

/** True when every point in the series has a zero view count. */
export function isAllZeroSeries(dailyViews: DailyViewPoint[]): boolean {
  return dailyViews.every((point) => point.viewCount === 0);
}
