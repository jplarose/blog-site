namespace BlogSite.Api.Common;

/// <summary>
/// A validated, UTC-calendar-date window for analytics queries (issue #42).
/// Boundaries are dates, not instants: <c>Since = today_utc - (days - 1)</c>,
/// <c>Until = today_utc</c> (inclusive), so "30 days" means today plus the
/// previous 29 days and the daily-view series always has exactly
/// <see cref="Days"/> entries. Using calendar dates (rather than
/// <c>DateTime.UtcNow.AddDays(-days)</c>, a moving instant) keeps totals,
/// top posts, and the date-grouped daily series aligned to the same window.
/// </summary>
/// <param name="Since">Oldest UTC calendar date included in the window (inclusive).</param>
/// <param name="Until">Newest UTC calendar date included in the window (inclusive) — always "today" in UTC.</param>
/// <param name="Days">Number of calendar days spanned (<c>Until - Since + 1</c>).</param>
public sealed record AnalyticsWindow(DateOnly Since, DateOnly Until, int Days)
{
    /// <summary>Smallest accepted value for the <c>days</c> query parameter.</summary>
    public const int MinDays = 1;

    /// <summary>Largest accepted value for the <c>days</c> query parameter.</summary>
    public const int MaxDays = 365;

    /// <summary>
    /// Validates <paramref name="days"/> and, if valid, builds the window
    /// anchored to "today" in UTC (derived from <paramref name="utcNow"/>).
    /// </summary>
    public static bool TryCreate(
        int days,
        DateTime utcNow,
        out AnalyticsWindow? window,
        out string? errorMessage)
    {
        if (days < MinDays || days > MaxDays)
        {
            window = null;
            errorMessage = $"days must be between {MinDays} and {MaxDays}.";
            return false;
        }

        var today = DateOnly.FromDateTime(utcNow);
        window = new AnalyticsWindow(today.AddDays(-(days - 1)), today, days);
        errorMessage = null;
        return true;
    }

    /// <summary>
    /// Inclusive lower bound, as UTC midnight, for a half-open SQL range
    /// scan against an indexed <c>timestamp</c> column.
    /// </summary>
    public DateTime SinceUtc => Since.ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc);

    /// <summary>
    /// Exclusive upper bound, as UTC midnight the day after <see cref="Until"/>,
    /// for a half-open SQL range scan (<c>viewed_at &gt;= Since AND viewed_at &lt; UntilExclusiveUtc</c>).
    /// </summary>
    public DateTime UntilExclusiveUtc => Until.AddDays(1).ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc);
}
