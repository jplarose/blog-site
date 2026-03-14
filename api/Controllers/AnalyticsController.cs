using BlogSite.Api.Data;
using BlogSite.Api.DTOs;
using BlogSite.Api.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace BlogSite.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AnalyticsController(BlogDbContext db) : ControllerBase
{
    [HttpGet("summary")]
    public async Task<ActionResult<AnalyticsSummaryDto>> GetSummary(
        [FromQuery] int days = 30)
    {
        var since = DateTime.UtcNow.AddDays(-days);

        var totalViews = await db.PageViews
            .Where(pv => pv.ViewedAt >= since)
            .CountAsync();

        var uniqueVisitors = await db.PageViews
            .Where(pv => pv.ViewedAt >= since && pv.IpAddress != null)
            .Select(pv => pv.IpAddress)
            .Distinct()
            .CountAsync();

        var totalPosts = await db.Posts.CountAsync();
        var publishedPosts = await db.Posts.CountAsync(p => p.Status == PostStatus.Published);
        var draftPosts = await db.Posts.CountAsync(p => p.Status == PostStatus.Draft);

        var topPosts = await db.PageViews
            .Where(pv => pv.PostId != null && pv.ViewedAt >= since)
            .GroupBy(pv => pv.PostId)
            .Select(g => new { PostId = g.Key!.Value, ViewCount = g.Count() })
            .OrderByDescending(x => x.ViewCount)
            .Take(10)
            .Join(db.Posts, x => x.PostId, p => p.Id,
                (x, p) => new TopPostDto(p.Id, p.Title, p.Slug, x.ViewCount))
            .ToListAsync();

        var dailyViews = await db.PageViews
            .Where(pv => pv.ViewedAt >= since)
            .GroupBy(pv => pv.ViewedAt.Date)
            .Select(g => new DailyViewDto(DateOnly.FromDateTime(g.Key), g.Count()))
            .OrderBy(d => d.Date)
            .ToListAsync();

        return Ok(new AnalyticsSummaryDto(
            totalViews, uniqueVisitors, totalPosts,
            publishedPosts, draftPosts, topPosts, dailyViews
        ));
    }

    [HttpPost("pageview")]
    public async Task<IActionResult> RecordPageView([FromBody] RecordPageViewRequest request)
    {
        var pageView = new PageView
        {
            PostId = request.PostId,
            Path = request.Path,
            IpAddress = HttpContext.Connection.RemoteIpAddress?.ToString(),
            UserAgent = Request.Headers.UserAgent.ToString(),
            Referrer = request.Referrer
        };

        db.PageViews.Add(pageView);
        await db.SaveChangesAsync();
        return Ok();
    }
}

public record RecordPageViewRequest(int? PostId, string Path, string? Referrer);
