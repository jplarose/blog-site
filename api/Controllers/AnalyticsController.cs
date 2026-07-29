using BlogSite.Api.Common;
using BlogSite.Api.DTOs;
using BlogSite.Api.Repositories;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

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

    /// <summary>Records a page view for analytics reporting.</summary>
    /// <param name="request">Page-view details.</param>
    /// <param name="cancellationToken">Cancels the database operation.</param>
    [HttpPost("pageview")]
    [AllowAnonymous]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<IActionResult> RecordPageView(
        [FromBody] RecordPageViewRequest request,
        CancellationToken cancellationToken)
    {
        await analytics.RecordPageViewAsync(
            request.PostId,
            request.Path,
            HttpContext.Connection.RemoteIpAddress?.ToString(),
            Request.Headers.UserAgent.ToString(),
            request.Referrer,
            cancellationToken);

        return Ok();
    }
}

public record RecordPageViewRequest(int? PostId, string Path, string? Referrer);
