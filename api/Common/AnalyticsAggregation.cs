using BlogSite.Api.DTOs;

namespace BlogSite.Api.Common;

/// <summary>
/// Shapes raw, grouped analytics query results into the dashboard-ready
/// contract from issue #42. Both operations run in C# after an indexed,
/// grouped SQL query so the SQL itself stays a simple sargable scan and the
/// shaping rules (gap-filling, deterministic ranking) are unit-testable
/// without a database.
/// </summary>
public static class AnalyticsAggregation
{
    /// <summary>Fixed number of posts returned by <see cref="RankTopPosts"/>.</summary>
    public const int TopPostsLimit = 5;

    /// <summary>
    /// Builds a contiguous daily-view series spanning <paramref name="window"/>
    /// exactly (one entry per day, oldest to newest), zero-filling any day the
    /// grouped SQL query had no rows for. An empty <paramref name="observed"/>
    /// input yields an all-zero series of length <see cref="AnalyticsWindow.Days"/>,
    /// never an empty or null list.
    /// </summary>
    public static IReadOnlyList<DailyViewDto> BuildDailySeries(
        AnalyticsWindow window,
        IEnumerable<DailyViewDto> observed)
    {
        var countsByDate = observed.ToDictionary(row => row.Date, row => row.ViewCount);
        var series = new List<DailyViewDto>(window.Days);

        for (var date = window.Since; date <= window.Until; date = date.AddDays(1))
        {
            series.Add(new DailyViewDto(
                date,
                countsByDate.TryGetValue(date, out var viewCount) ? viewCount : 0));
        }

        return series;
    }

    /// <summary>
    /// Orders posts by <c>ViewCount</c> descending, breaking ties by
    /// <c>PostId</c> ascending for a deterministic order, and limits the
    /// result to <see cref="TopPostsLimit"/> entries. An empty
    /// <paramref name="observed"/> input yields an empty (never null) list.
    /// </summary>
    public static IReadOnlyList<TopPostDto> RankTopPosts(IEnumerable<TopPostDto> observed) =>
        observed
            .OrderByDescending(post => post.ViewCount)
            .ThenBy(post => post.PostId)
            .Take(TopPostsLimit)
            .ToList();
}
