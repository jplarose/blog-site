using System.Net;
using System.Net.Http.Json;
using BlogSite.Api.Controllers;
using Microsoft.AspNetCore.Hosting;

namespace BlogSite.Api.Tests.Auth;

/// <summary>
/// Hardening tests for the anonymous pageview beacon (final branch review,
/// finding 4): path validation, referrer bounding, unknown-postId
/// tolerance, and the per-IP fixed-window rate limit.
/// </summary>
public class AnalyticsPageViewTests
{
    private static readonly object ValidPayload = new
    {
        postId = (int?)null,
        path = "/blog/hello-world",
        referrer = "https://search.example.com/",
    };

    [Fact]
    public async Task RecordPageView_ValidPayload_Returns200AndRecords()
    {
        using var factory = new AuthTestWebApplicationFactory();
        using var client = factory.CreateClient();

        var response = await client.PostAsJsonAsync("/api/analytics/pageview", ValidPayload);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal(1, factory.AnalyticsRepository.RecordedPageViews);
        Assert.Equal("/blog/hello-world", factory.AnalyticsRepository.CapturedPath);
    }

    [Fact]
    public async Task RecordPageView_MissingPath_Returns400WithoutRecording()
    {
        using var factory = new AuthTestWebApplicationFactory();
        using var client = factory.CreateClient();

        var response = await client.PostAsJsonAsync(
            "/api/analytics/pageview",
            new { postId = (int?)null, path = (string?)null, referrer = (string?)null });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal(0, factory.AnalyticsRepository.RecordedPageViews);
    }

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    public async Task RecordPageView_BlankPath_Returns400WithoutRecording(string path)
    {
        using var factory = new AuthTestWebApplicationFactory();
        using var client = factory.CreateClient();

        var response = await client.PostAsJsonAsync(
            "/api/analytics/pageview",
            new { postId = (int?)null, path, referrer = (string?)null });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal(0, factory.AnalyticsRepository.RecordedPageViews);
    }

    [Fact]
    public async Task RecordPageView_PathOverColumnLimit_Returns400WithoutRecording()
    {
        using var factory = new AuthTestWebApplicationFactory();
        using var client = factory.CreateClient();

        var response = await client.PostAsJsonAsync(
            "/api/analytics/pageview",
            new
            {
                postId = (int?)null,
                path = new string('a', AnalyticsController.MaxPathLength + 1),
                referrer = (string?)null,
            });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal(0, factory.AnalyticsRepository.RecordedPageViews);
    }

    [Fact]
    public async Task RecordPageView_PathAtColumnLimit_IsAccepted()
    {
        using var factory = new AuthTestWebApplicationFactory();
        using var client = factory.CreateClient();

        var response = await client.PostAsJsonAsync(
            "/api/analytics/pageview",
            new
            {
                postId = (int?)null,
                path = new string('a', AnalyticsController.MaxPathLength),
                referrer = (string?)null,
            });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal(1, factory.AnalyticsRepository.RecordedPageViews);
    }

    [Fact]
    public async Task RecordPageView_OversizedReferrer_IsTruncatedNotRejected()
    {
        using var factory = new AuthTestWebApplicationFactory();
        using var client = factory.CreateClient();

        var response = await client.PostAsJsonAsync(
            "/api/analytics/pageview",
            new
            {
                postId = (int?)null,
                path = "/blog/hello-world",
                referrer = new string('r', AnalyticsController.MaxReferrerLength + 500),
            });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal(
            AnalyticsController.MaxReferrerLength,
            factory.AnalyticsRepository.CapturedReferrer?.Length);
    }

    [Fact]
    public async Task RecordPageView_UnknownPostId_IsToleratedAndStillRecorded()
    {
        // Controller-level tolerance is delegated to the repository's
        // resolve-or-null insert; the endpoint must accept the payload and
        // pass the id through rather than 500 on an FK violation.
        using var factory = new AuthTestWebApplicationFactory();
        using var client = factory.CreateClient();

        var response = await client.PostAsJsonAsync(
            "/api/analytics/pageview",
            new { postId = (int?)999_999, path = "/blog/deleted-post", referrer = (string?)null });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal(1, factory.AnalyticsRepository.RecordedPageViews);
        Assert.Equal(999_999, factory.AnalyticsRepository.CapturedPostId);
    }

    [Fact]
    public async Task RecordPageView_OverPermitLimit_Returns429WithoutRecording()
    {
        using var factory = new AuthTestWebApplicationFactory();
        // Tiny permit limit and a window far longer than the test run make
        // the fixed-window rejection deterministic (no timing dependence).
        using var limited = factory.WithWebHostBuilder(builder =>
        {
            builder.UseSetting("RateLimiting:PageView:PermitLimit", "2");
            builder.UseSetting("RateLimiting:PageView:WindowSeconds", "3600");
        });
        using var client = limited.CreateClient();

        var first = await client.PostAsJsonAsync("/api/analytics/pageview", ValidPayload);
        var second = await client.PostAsJsonAsync("/api/analytics/pageview", ValidPayload);
        var third = await client.PostAsJsonAsync("/api/analytics/pageview", ValidPayload);

        Assert.Equal(HttpStatusCode.OK, first.StatusCode);
        Assert.Equal(HttpStatusCode.OK, second.StatusCode);
        Assert.Equal(HttpStatusCode.TooManyRequests, third.StatusCode);
        Assert.Equal(2, factory.AnalyticsRepository.RecordedPageViews);
    }

    [Fact]
    public async Task RecordPageView_RateLimitDoesNotThrottleOtherEndpoints()
    {
        using var factory = new AuthTestWebApplicationFactory();
        using var limited = factory.WithWebHostBuilder(builder =>
        {
            builder.UseSetting("RateLimiting:PageView:PermitLimit", "1");
            builder.UseSetting("RateLimiting:PageView:WindowSeconds", "3600");
        });
        using var client = limited.CreateClient();

        await client.PostAsJsonAsync("/api/analytics/pageview", ValidPayload);
        await client.PostAsJsonAsync("/api/analytics/pageview", ValidPayload);

        // The policy is scoped to the pageview beacon only.
        var publicRead = await client.GetAsync("/api/posts");

        Assert.Equal(HttpStatusCode.OK, publicRead.StatusCode);
    }
}
