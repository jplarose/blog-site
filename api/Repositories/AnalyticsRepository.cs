using BlogSite.Api.DTOs;
using Dapper;
using System.Data;

namespace BlogSite.Api.Repositories;

public interface IAnalyticsRepository
{
    Task<AnalyticsSummaryDto> GetSummaryAsync(
        DateTime since,
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
    public async Task<AnalyticsSummaryDto> GetSummaryAsync(
        DateTime since,
        CancellationToken cancellationToken)
    {
        const string totalsSql = """
            SELECT
                (
                    SELECT COUNT(*)::int
                    FROM page_views
                    WHERE viewed_at >= @Since
                ) AS TotalPageViews,
                (
                    SELECT COUNT(DISTINCT ip_address)::int
                    FROM page_views
                    WHERE viewed_at >= @Since
                        AND ip_address IS NOT NULL
                ) AS UniqueVisitors,
                (
                    SELECT COUNT(*)::int
                    FROM posts
                ) AS TotalPosts,
                (
                    SELECT COUNT(*)::int
                    FROM posts
                    WHERE status = 'Published'
                ) AS PublishedPosts,
                (
                    SELECT COUNT(*)::int
                    FROM posts
                    WHERE status = 'Draft'
                ) AS DraftPosts;
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
            GROUP BY
                post.id,
                post.title,
                post.slug
            ORDER BY ViewCount DESC
            LIMIT 10;
            """;

        const string dailyViewsSql = """
            SELECT
                page_view.viewed_at::date AS Date,
                COUNT(*)::int AS ViewCount
            FROM page_views AS page_view
            WHERE page_view.viewed_at >= @Since
            GROUP BY page_view.viewed_at::date
            ORDER BY Date;
            """;

        var parameters = new { Since = since };
        var totals = await db.QuerySingleAsync<AnalyticsTotals>(
            new CommandDefinition(
                totalsSql,
                parameters,
                cancellationToken: cancellationToken));
        var topPosts = await db.QueryAsync<TopPostDto>(
            new CommandDefinition(
                topPostsSql,
                parameters,
                cancellationToken: cancellationToken));
        var dailyRows = await db.QueryAsync<DailyViewRow>(
            new CommandDefinition(
                dailyViewsSql,
                parameters,
                cancellationToken: cancellationToken));

        return new AnalyticsSummaryDto(
            totals.TotalPageViews,
            totals.UniqueVisitors,
            totals.TotalPosts,
            totals.PublishedPosts,
            totals.DraftPosts,
            topPosts.AsList(),
            dailyRows.Select(row => new DailyViewDto(
                DateOnly.FromDateTime(row.Date),
                row.ViewCount)).ToList());
    }

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
                @PostId,
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

    private sealed record AnalyticsTotals(
        int TotalPageViews,
        int UniqueVisitors,
        int TotalPosts,
        int PublishedPosts,
        int DraftPosts);

    private sealed record DailyViewRow(DateTime Date, int ViewCount);
}
