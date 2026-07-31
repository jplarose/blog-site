using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using BlogSite.Api.DTOs;

namespace BlogSite.Api.Tests.Auth;

/// <summary>
/// Exercises the issue #42 analytics summary contract at the HTTP layer:
/// range validation (400 for out-of-bounds <c>days</c>), the endpoint
/// staying behind <c>[Authorize]</c>, and the window that reaches the
/// repository matching the requested day count.
/// </summary>
public class AnalyticsSummaryTests
{
    private static HttpClient AuthenticatedClient(AuthTestWebApplicationFactory factory)
    {
        factory.JtiValidator.IsValid = true;
        var client = factory.CreateClient();
        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", TestJwtTokens.CreateValid());
        return client;
    }

    [Fact]
    public async Task GetSummary_Anonymous_Returns401()
    {
        using var factory = new AuthTestWebApplicationFactory();
        using var client = factory.CreateClient();

        var response = await client.GetAsync("/api/analytics/summary");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Theory]
    [InlineData(0)]
    [InlineData(-5)]
    [InlineData(366)]
    [InlineData(100000)]
    public async Task GetSummary_DaysOutOfRange_Returns400(int days)
    {
        using var factory = new AuthTestWebApplicationFactory();
        using var client = AuthenticatedClient(factory);

        var response = await client.GetAsync($"/api/analytics/summary?days={days}");

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Theory]
    [InlineData(1)]
    [InlineData(30)]
    [InlineData(365)]
    public async Task GetSummary_DaysInRange_Returns200(int days)
    {
        using var factory = new AuthTestWebApplicationFactory();
        using var client = AuthenticatedClient(factory);

        var response = await client.GetAsync($"/api/analytics/summary?days={days}");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task GetSummary_NoDaysParameter_DefaultsToThirtyDayWindow()
    {
        using var factory = new AuthTestWebApplicationFactory();
        using var client = AuthenticatedClient(factory);

        var response = await client.GetAsync("/api/analytics/summary");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.NotNull(factory.AnalyticsRepository.CapturedWindow);
        Assert.Equal(30, factory.AnalyticsRepository.CapturedWindow!.Days);
    }

    [Fact]
    public async Task GetSummary_ExplicitDays_PassesMatchingWindowToRepository()
    {
        using var factory = new AuthTestWebApplicationFactory();
        using var client = AuthenticatedClient(factory);

        var response = await client.GetAsync("/api/analytics/summary?days=7");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal(7, factory.AnalyticsRepository.CapturedWindow!.Days);
        Assert.Equal(
            factory.AnalyticsRepository.CapturedWindow.Until,
            factory.AnalyticsRepository.CapturedWindow.Since.AddDays(6));
    }

    [Fact]
    public async Task GetSummary_EmptyPeriod_ReturnsStableZeroValuesAndNeverNullCollections()
    {
        using var factory = new AuthTestWebApplicationFactory();
        factory.AnalyticsRepository.Result = new AnalyticsSummaryDto(0, 0, 0, 0, 0, 0, 0, [], []);
        using var client = AuthenticatedClient(factory);

        var response = await client.GetAsync("/api/analytics/summary?days=5");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var summary = await response.Content.ReadFromJsonAsync<AnalyticsSummaryDto>();
        Assert.NotNull(summary);
        Assert.NotNull(summary!.TopPosts);
        Assert.NotNull(summary.DailyViews);
        Assert.Equal(0, summary.TotalPageViews);
        Assert.Equal(0, summary.UniqueVisitors);
    }

    [Fact]
    public async Task GetSummary_FourStateCounts_RoundTripThroughTheContract()
    {
        using var factory = new AuthTestWebApplicationFactory();
        factory.AnalyticsRepository.Result = new AnalyticsSummaryDto(
            TotalPageViews: 42,
            UniqueVisitors: 11,
            TotalPosts: 10,
            PublishedPosts: 4,
            DraftPosts: 3,
            ScheduledPosts: 2,
            ArchivedPosts: 1,
            TopPosts: [],
            DailyViews: []);
        using var client = AuthenticatedClient(factory);

        var response = await client.GetAsync("/api/analytics/summary?days=30");

        var summary = await response.Content.ReadFromJsonAsync<AnalyticsSummaryDto>();
        Assert.Equal(10, summary!.TotalPosts);
        Assert.Equal(4, summary.PublishedPosts);
        Assert.Equal(3, summary.DraftPosts);
        Assert.Equal(2, summary.ScheduledPosts);
        Assert.Equal(1, summary.ArchivedPosts);
    }
}
