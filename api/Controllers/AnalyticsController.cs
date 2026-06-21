using BlogSite.Api.DTOs;
using BlogSite.Api.Repositories;
using Microsoft.AspNetCore.Mvc;

namespace BlogSite.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AnalyticsController(IAnalyticsRepository analytics) : ControllerBase
{
    /// <summary>Gets aggregate analytics for the requested number of days.</summary>
    /// <param name="days">Number of days to include. Defaults to 30.</param>
    /// <param name="cancellationToken">Cancels the database operation.</param>
    [HttpGet("summary")]
    [ProducesResponseType(typeof(AnalyticsSummaryDto), StatusCodes.Status200OK)]
    public async Task<ActionResult<AnalyticsSummaryDto>> GetSummary(
        [FromQuery] int days = 30,
        CancellationToken cancellationToken = default)
    {
        var since = DateTime.UtcNow.AddDays(-days);
        return Ok(await analytics.GetSummaryAsync(since, cancellationToken));
    }

    /// <summary>Records a page view for analytics reporting.</summary>
    /// <param name="request">Page-view details.</param>
    /// <param name="cancellationToken">Cancels the database operation.</param>
    [HttpPost("pageview")]
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
