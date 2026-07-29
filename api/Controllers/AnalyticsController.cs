using BlogSite.Api.Common;
using BlogSite.Api.DTOs;
using BlogSite.Api.Repositories;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace BlogSite.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class AnalyticsController(IAnalyticsRepository analytics) : ControllerBase
{
    /// <summary>Gets aggregate analytics for the requested number of days.</summary>
    /// <param name="days">
    /// Number of days to include, 1-365 inclusive. Defaults to 30. The
    /// window is anchored to "today" in UTC:
    /// <c>Since = today_utc - (days - 1)</c>, so the daily-view series has
    /// exactly <paramref name="days"/> entries.
    /// </param>
    /// <param name="cancellationToken">Cancels the database operation.</param>
    [HttpGet("summary")]
    [ProducesResponseType(typeof(AnalyticsSummaryDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<ActionResult<AnalyticsSummaryDto>> GetSummary(
        [FromQuery] int days = 30,
        CancellationToken cancellationToken = default)
    {
        if (!AnalyticsWindow.TryCreate(days, DateTime.UtcNow, out var window, out var errorMessage))
        {
            return BadRequest(errorMessage);
        }

        return Ok(await analytics.GetSummaryAsync(window!, cancellationToken));
    }

    /// <summary>
    /// Maximum accepted <c>path</c> length, matching the
    /// <c>page_views.path VARCHAR(1000)</c> column.
    /// </summary>
    internal const int MaxPathLength = 1000;

    /// <summary>
    /// Maximum stored <c>referrer</c> length. The column is unbounded
    /// TEXT, so this is a policy bound: longer values are truncated (not
    /// rejected) because the referrer is best-effort telemetry sent
    /// verbatim from <c>document.referrer</c> and must never cost a view.
    /// </summary>
    internal const int MaxReferrerLength = 2000;

    /// <summary>Records a page view for analytics reporting.</summary>
    /// <remarks>
    /// Anonymous, rate-limited beacon endpoint. <c>path</c> is required and
    /// bounded to the storage column; <c>referrer</c> is truncated to a
    /// policy bound; an unknown <c>postId</c> is tolerated and recorded as
    /// a post-less view (see <see cref="IAnalyticsRepository.RecordPageViewAsync"/>)
    /// rather than failing the request — the sender is an untrusted public
    /// client and a stale id (e.g. a just-deleted post) is not an error.
    /// </remarks>
    /// <param name="request">Page-view details.</param>
    /// <param name="cancellationToken">Cancels the database operation.</param>
    [HttpPost("pageview")]
    [AllowAnonymous]
    [EnableRateLimiting(RateLimitPolicies.AnalyticsPageView)]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status429TooManyRequests)]
    public async Task<IActionResult> RecordPageView(
        [FromBody] RecordPageViewRequest request,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.Path))
        {
            return BadRequest("Path is required.");
        }

        if (request.Path.Length > MaxPathLength)
        {
            return BadRequest($"Path must be {MaxPathLength} characters or fewer.");
        }

        var referrer = string.IsNullOrWhiteSpace(request.Referrer)
            ? null
            : request.Referrer.Length > MaxReferrerLength
                ? request.Referrer[..MaxReferrerLength]
                : request.Referrer;

        await analytics.RecordPageViewAsync(
            request.PostId,
            request.Path,
            HttpContext.Connection.RemoteIpAddress?.ToString(),
            Request.Headers.UserAgent.ToString(),
            referrer,
            cancellationToken);

        return Ok();
    }
}

/// <summary>Named rate-limiting policies registered in <c>Program.cs</c>.</summary>
public static class RateLimitPolicies
{
    /// <summary>
    /// Per-IP fixed-window limit for the anonymous pageview beacon.
    /// Configured via <c>RateLimiting:PageView</c> (PermitLimit /
    /// WindowSeconds) with code defaults.
    /// </summary>
    public const string AnalyticsPageView = "analytics-pageview";
}

public record RecordPageViewRequest(int? PostId, string Path, string? Referrer);
