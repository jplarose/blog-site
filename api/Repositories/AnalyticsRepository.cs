using BlogSite.Api.Common;
using BlogSite.Api.DTOs;
using Dapper;
using System.Data;

namespace BlogSite.Api.Repositories;

public interface IAnalyticsRepository
{
    Task<AnalyticsSummaryDto> GetSummaryAsync(
        AnalyticsWindow window,
        CancellationToken cancellationToken);
    Task RecordPageViewAsync(
        int? postId,
        string path,
        string? ipAddress,
        string? userAgent,
        string? referrer,
        CancellationToken cancellationToken);
}

public sealed class AnalyticsRepository(IDbConnection db) : IAnalyticsRepository
{
    /// <summary>
    /// Loads the dashboard summary for <paramref name="window"/>. Every
    /// windowed query uses the same half-open UTC range
    /// (<c>viewed_at &gt;= @Since AND viewed_at &lt; @UntilExclusive</c>) so
    /// totals, top posts, and the daily series all agree on the same
    /// boundary as the date-grouped rows. Post-state counts come from a
    /// single <c>GROUP BY status</c> query rather than four separate scans.
    /// Gap-filling the daily series and ranking/limiting top posts happen in
    /// C# (<see cref="AnalyticsAggregation"/>) after these indexed, grouped
    /// queries return.
    /// </summary>
    public async Task<AnalyticsSummaryDto> GetSummaryAsync(
        AnalyticsWindow window,
        CancellationToken cancellationToken)
    {
        const string totalsSql = """
            SELECT
                COUNT(*)::int AS TotalPageViews,
                COUNT(DISTINCT ip_address)
                    FILTER (WHERE ip_address IS NOT NULL)::int AS UniqueVisitors
            FROM page_views
            WHERE viewed_at >= @Since
                AND viewed_at < @UntilExclusive;
            """;

        const string statusCountsSql = """
            SELECT
                status AS Status,
                COUNT(*)::int AS Count
            FROM posts
            GROUP BY status;
            """;

        const string topPostsSql = """
            SELECT
                post.id AS PostId,
                post.title AS Title,
                post.slug AS Slug,
                COUNT(page_view.id)::int AS ViewCount
            FROM page_views AS page_view
            INNER JOIN posts AS post
                ON post.id = page_view.post_id
            WHERE page_view.viewed_at >= @Since
                AND page_view.viewed_at < @UntilExclusive
            GROUP BY
                post.id,
                post.title,
                post.slug;
            """;

        const string dailyViewsSql = """
            SELECT
                page_view.viewed_at::date AS Date,
                COUNT(*)::int AS ViewCount
            FROM page_views AS page_view
            WHERE page_view.viewed_at >= @Since
                AND page_view.viewed_at < @UntilExclusive
            GROUP BY page_view.viewed_at::date;
            """;

        var parameters = new { Since = window.SinceUtc, UntilExclusive = window.UntilExclusiveUtc };

        var totals = await db.QuerySingleAsync<WindowTotals>(
            new CommandDefinition(
                totalsSql,
                parameters,
                cancellationToken: cancellationToken));
        var statusCounts = await db.QueryAsync<StatusCountRow>(
            new CommandDefinition(
                statusCountsSql,
                cancellationToken: cancellationToken));
        var topPostRows = await db.QueryAsync<TopPostDto>(
            new CommandDefinition(
                topPostsSql,
                parameters,
                cancellationToken: cancellationToken));
        var dailyRows = await db.QueryAsync<DailyViewRow>(
            new CommandDefinition(
                dailyViewsSql,
                parameters,
                cancellationToken: cancellationToken));

        var countsByStatus = statusCounts.ToDictionary(row => row.Status, row => row.Count);
        int CountFor(string status) => countsByStatus.TryGetValue(status, out var count) ? count : 0;

        var publishedPosts = CountFor("Published");
        var draftPosts = CountFor("Draft");
        var scheduledPosts = CountFor("Scheduled");
        var archivedPosts = CountFor("Archived");

        return new AnalyticsSummaryDto(
            totals.TotalPageViews,
            totals.UniqueVisitors,
            publishedPosts + draftPosts + scheduledPosts + archivedPosts,
            publishedPosts,
            draftPosts,
            scheduledPosts,
            archivedPosts,
            AnalyticsAggregation.RankTopPosts(topPostRows),
            AnalyticsAggregation.BuildDailySeries(
                window,
                dailyRows.Select(row => new DailyViewDto(row.Date, row.ViewCount))));
    }

    /// <summary>
    /// Inserts a page view. An unknown <paramref name="postId"/> is
    /// tolerated by resolving it through a subselect against
    /// <c>posts.id</c>: a bogus or stale id records as a post-less view
    /// (<c>post_id IS NULL</c>) instead of raising an FK violation — the
    /// sender is an anonymous public client whose payload must never be
    /// able to 500 this endpoint.
    /// </summary>
    public async Task RecordPageViewAsync(
        int? postId,
        string path,
        string? ipAddress,
        string? userAgent,
        string? referrer,
        CancellationToken cancellationToken)
    {
        const string sql = """
            INSERT INTO page_views (
                post_id,
                path,
                ip_address,
                user_agent,
                referrer
            )
            VALUES (
                (SELECT id FROM posts WHERE id = @PostId),
                @Path,
                @IpAddress,
                @UserAgent,
                @Referrer
            );
            """;

        var command = new CommandDefinition(
            sql,
            new
            {
                PostId = postId,
                Path = path,
                IpAddress = ipAddress,
                UserAgent = userAgent,
                Referrer = referrer
            },
            cancellationToken: cancellationToken);

        await db.ExecuteAsync(command);
    }

    private sealed record WindowTotals(int TotalPageViews, int UniqueVisitors);

    private sealed record StatusCountRow(string Status, int Count);

    // Npgsql maps `date` columns to DateOnly; Dapper's constructor matching
    // needs the parameter type to line up exactly.
    private sealed record DailyViewRow(DateOnly Date, int ViewCount);
}
