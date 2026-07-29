using BlogSite.Api.Common;

namespace BlogSite.Api.Tests.Common;

/// <summary>
/// Validates the day-range contract for issue #42: 1-365 inclusive, and the
/// UTC-calendar-date window boundary (Since = today_utc - (days - 1),
/// Until = today_utc) that keeps totals, top posts, and the daily series
/// aligned to the same window.
/// </summary>
public class AnalyticsWindowTests
{
    private static readonly DateTime UtcNow = new(2026, 7, 28, 15, 42, 0, DateTimeKind.Utc);

    [Theory]
    [InlineData(0)]
    [InlineData(-5)]
    [InlineData(-100000)]
    public void TryCreate_DaysBelowMinimum_ReturnsFalseWithMessage(int days)
    {
        var created = AnalyticsWindow.TryCreate(days, UtcNow, out var window, out var errorMessage);

        Assert.False(created);
        Assert.Null(window);
        Assert.False(string.IsNullOrWhiteSpace(errorMessage));
    }

    [Theory]
    [InlineData(366)]
    [InlineData(100000)]
    public void TryCreate_DaysAboveMaximum_ReturnsFalseWithMessage(int days)
    {
        var created = AnalyticsWindow.TryCreate(days, UtcNow, out var window, out var errorMessage);

        Assert.False(created);
        Assert.Null(window);
        Assert.False(string.IsNullOrWhiteSpace(errorMessage));
    }

    [Fact]
    public void TryCreate_MinimumBoundary_OneDay_ReturnsSingleDayWindow()
    {
        var created = AnalyticsWindow.TryCreate(1, UtcNow, out var window, out var errorMessage);

        Assert.True(created);
        Assert.Null(errorMessage);
        Assert.Equal(new DateOnly(2026, 7, 28), window!.Since);
        Assert.Equal(new DateOnly(2026, 7, 28), window.Until);
        Assert.Equal(1, window.Days);
    }

    [Fact]
    public void TryCreate_MaximumBoundary_365Days_Succeeds()
    {
        var created = AnalyticsWindow.TryCreate(365, UtcNow, out var window, out var errorMessage);

        Assert.True(created);
        Assert.Null(errorMessage);
        Assert.Equal(365, window!.Days);
        Assert.Equal(new DateOnly(2025, 7, 29), window.Since);
        Assert.Equal(new DateOnly(2026, 7, 28), window.Until);
    }

    [Fact]
    public void TryCreate_ThirtyDays_TodayPlusPrevious29_MatchesDailySeriesLength()
    {
        var created = AnalyticsWindow.TryCreate(30, UtcNow, out var window, out _);

        Assert.True(created);
        Assert.Equal(new DateOnly(2026, 6, 29), window!.Since);
        Assert.Equal(new DateOnly(2026, 7, 28), window.Until);
        Assert.Equal(30, (window.Until.DayNumber - window.Since.DayNumber) + 1);
    }

    [Fact]
    public void SinceUtc_And_UntilExclusiveUtc_FormAHalfOpenUtcRange()
    {
        AnalyticsWindow.TryCreate(30, UtcNow, out var window, out _);

        Assert.Equal(DateTimeKind.Utc, window!.SinceUtc.Kind);
        Assert.Equal(DateTimeKind.Utc, window.UntilExclusiveUtc.Kind);
        Assert.Equal(new DateTime(2026, 6, 29, 0, 0, 0, DateTimeKind.Utc), window.SinceUtc);
        Assert.Equal(new DateTime(2026, 7, 29, 0, 0, 0, DateTimeKind.Utc), window.UntilExclusiveUtc);
    }
}
