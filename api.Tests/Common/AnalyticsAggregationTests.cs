using BlogSite.Api.Common;
using BlogSite.Api.DTOs;

namespace BlogSite.Api.Tests.Common;

/// <summary>
/// Covers the in-C# shaping issue #42 requires: a contiguous, zero-filled
/// daily-view series (gap-filling happens here, after the grouped/indexed
/// SQL query returns only days that had views) and deterministic top-post
/// ranking (ViewCount DESC, PostId ASC tiebreak, fixed limit of 5).
/// </summary>
public class AnalyticsAggregationTests
{
    private static AnalyticsWindow Window(int days)
    {
        AnalyticsWindow.TryCreate(days, new DateTime(2026, 7, 28, 0, 0, 0, DateTimeKind.Utc), out var window, out _);
        return window!;
    }

    [Fact]
    public void BuildDailySeries_EmptyPeriod_ReturnsContiguousAllZeroSeries()
    {
        var window = Window(5);

        var series = AnalyticsAggregation.BuildDailySeries(window, []);

        Assert.Equal(5, series.Count);
        Assert.All(series, entry => Assert.Equal(0, entry.ViewCount));
        Assert.Equal(
            [
                new DateOnly(2026, 7, 24),
                new DateOnly(2026, 7, 25),
                new DateOnly(2026, 7, 26),
                new DateOnly(2026, 7, 27),
                new DateOnly(2026, 7, 28)
            ],
            series.Select(entry => entry.Date).ToList());
    }

    [Fact]
    public void BuildDailySeries_SparseObservedRows_FillsGapsWithZeroAndPreservesOrder()
    {
        var window = Window(5);
        var observed = new[]
        {
            new DailyViewDto(new DateOnly(2026, 7, 24), 3),
            new DailyViewDto(new DateOnly(2026, 7, 28), 7)
        };

        var series = AnalyticsAggregation.BuildDailySeries(window, observed);

        Assert.Equal(5, series.Count);
        Assert.Equal(3, series[0].ViewCount);
        Assert.Equal(0, series[1].ViewCount);
        Assert.Equal(0, series[2].ViewCount);
        Assert.Equal(0, series[3].ViewCount);
        Assert.Equal(7, series[4].ViewCount);
    }

    [Fact]
    public void BuildDailySeries_SingleDayWindow_ReturnsExactlyOneEntry()
    {
        var window = Window(1);

        var series = AnalyticsAggregation.BuildDailySeries(window, []);

        Assert.Single(series);
        Assert.Equal(new DateOnly(2026, 7, 28), series[0].Date);
        Assert.Equal(0, series[0].ViewCount);
    }

    [Fact]
    public void RankTopPosts_OrdersByViewCountDescending()
    {
        var observed = new[]
        {
            new TopPostDto(1, "A", "a", 5),
            new TopPostDto(2, "B", "b", 20),
            new TopPostDto(3, "C", "c", 10)
        };

        var ranked = AnalyticsAggregation.RankTopPosts(observed);

        Assert.Equal([2, 3, 1], ranked.Select(post => post.PostId).ToList());
    }

    [Fact]
    public void RankTopPosts_TiedViewCount_BreaksTieByPostIdAscending()
    {
        var observed = new[]
        {
            new TopPostDto(5, "E", "e", 10),
            new TopPostDto(2, "B", "b", 10),
            new TopPostDto(3, "C", "c", 10)
        };

        var ranked = AnalyticsAggregation.RankTopPosts(observed);

        Assert.Equal([2, 3, 5], ranked.Select(post => post.PostId).ToList());
    }

    [Fact]
    public void RankTopPosts_MoreThanFive_LimitsToFive()
    {
        var observed = Enumerable.Range(1, 8)
            .Select(id => new TopPostDto(id, $"Post {id}", $"post-{id}", 100 - id))
            .ToList();

        var ranked = AnalyticsAggregation.RankTopPosts(observed);

        Assert.Equal(5, ranked.Count);
        Assert.Equal([1, 2, 3, 4, 5], ranked.Select(post => post.PostId).ToList());
    }

    [Fact]
    public void RankTopPosts_Empty_ReturnsEmptyNotNull()
    {
        var ranked = AnalyticsAggregation.RankTopPosts([]);

        Assert.NotNull(ranked);
        Assert.Empty(ranked);
    }
}
