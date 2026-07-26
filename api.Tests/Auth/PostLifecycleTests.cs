using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using BlogSite.Api.DTOs;

namespace BlogSite.Api.Tests.Auth;

/// <summary>
/// Exercises the post lifecycle endpoints (<c>/publish</c>, <c>/schedule</c>,
/// <c>/archive</c>) end to end through the real controller/service pipeline
/// with a stubbed repository, covering the 404-unknown-id and
/// happy-path outcomes described in issue #31. Authentication enforcement
/// for these routes is covered by <see cref="AuthenticationTests"/>.
/// </summary>
public class PostLifecycleTests
{
    private static PostDto SamplePost(string status) => new(
        1,
        "Title",
        "title",
        "Content",
        null,
        null,
        status,
        status == "Published" ? DateTime.UtcNow.AddDays(-1) : null,
        status == "Scheduled" ? DateTime.UtcNow.AddDays(1) : null,
        null,
        null,
        1,
        "article",
        "Article",
        [],
        DateTime.UtcNow,
        DateTime.UtcNow);

    private static HttpClient AuthenticatedClient(AuthTestWebApplicationFactory factory)
    {
        factory.JtiValidator.IsValid = true;
        var client = factory.CreateClient();
        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", TestJwtTokens.CreateValid());
        return client;
    }

    [Fact]
    public async Task Publish_UnknownId_Returns404()
    {
        using var factory = new AuthTestWebApplicationFactory();
        using var client = AuthenticatedClient(factory);

        var response = await client.PostAsync("/api/posts/1/publish", null);

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task Publish_HappyPath_ReturnsPublishedPost()
    {
        using var factory = new AuthTestWebApplicationFactory();
        factory.PostRepository.PublishResult = SamplePost("Published");
        using var client = AuthenticatedClient(factory);

        var response = await client.PostAsync("/api/posts/1/publish", null);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var post = await response.Content.ReadFromJsonAsync<PostDto>();
        Assert.Equal("Published", post!.Status);
    }

    [Fact]
    public async Task Schedule_UnknownId_Returns404()
    {
        using var factory = new AuthTestWebApplicationFactory();
        factory.PostRepository.ExistsResult = false;
        using var client = AuthenticatedClient(factory);

        var response = await client.PostAsJsonAsync(
            "/api/posts/1/schedule",
            new { scheduledAt = DateTime.UtcNow.AddDays(1) });

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task Schedule_MissingScheduledAt_Returns400()
    {
        using var factory = new AuthTestWebApplicationFactory();
        using var client = AuthenticatedClient(factory);

        var response = await client.PostAsJsonAsync(
            "/api/posts/1/schedule",
            new { });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task Schedule_PastScheduledAt_Returns400()
    {
        using var factory = new AuthTestWebApplicationFactory();
        using var client = AuthenticatedClient(factory);

        var response = await client.PostAsJsonAsync(
            "/api/posts/1/schedule",
            new { scheduledAt = DateTime.UtcNow.AddDays(-1) });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task Schedule_WrongState_Returns409()
    {
        using var factory = new AuthTestWebApplicationFactory();
        // Repository update affects 0 rows (post is Published/Archived),
        // but the post does exist.
        factory.PostRepository.ExistsResult = true;
        using var client = AuthenticatedClient(factory);

        var response = await client.PostAsJsonAsync(
            "/api/posts/1/schedule",
            new { scheduledAt = DateTime.UtcNow.AddDays(1) });

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
    }

    [Fact]
    public async Task Schedule_HappyPath_ReturnsScheduledPost()
    {
        using var factory = new AuthTestWebApplicationFactory();
        factory.PostRepository.ScheduleResult = SamplePost("Scheduled");
        using var client = AuthenticatedClient(factory);

        var response = await client.PostAsJsonAsync(
            "/api/posts/1/schedule",
            new { scheduledAt = DateTime.UtcNow.AddDays(1) });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var post = await response.Content.ReadFromJsonAsync<PostDto>();
        Assert.Equal("Scheduled", post!.Status);
    }

    [Fact]
    public async Task Archive_UnknownId_Returns404()
    {
        using var factory = new AuthTestWebApplicationFactory();
        using var client = AuthenticatedClient(factory);

        var response = await client.PostAsync("/api/posts/1/archive", null);

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task Archive_HappyPath_ReturnsArchivedPost()
    {
        using var factory = new AuthTestWebApplicationFactory();
        factory.PostRepository.ArchiveResult = SamplePost("Archived");
        using var client = AuthenticatedClient(factory);

        var response = await client.PostAsync("/api/posts/1/archive", null);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var post = await response.Content.ReadFromJsonAsync<PostDto>();
        Assert.Equal("Archived", post!.Status);
    }
}
