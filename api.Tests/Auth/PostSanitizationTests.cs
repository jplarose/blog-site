using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using BlogSite.Api.DTOs;

namespace BlogSite.Api.Tests.Auth;

/// <summary>
/// Exercises the HTML sanitization boundary (issue #34) end to end through
/// the real controller/service pipeline: hostile <c>Content</c>/<c>Title</c>/
/// <c>Excerpt</c> values must be neutralized before they ever reach the
/// repository, on both create and update. Assertions read
/// <see cref="FakePostRepository.CapturedCreate"/>/
/// <see cref="FakePostRepository.CapturedUpdate"/> — the value captured at
/// the stubbed repository — so these prove the persisted value is clean,
/// not just the HTTP response.
/// </summary>
public class PostSanitizationTests
{
    private static HttpClient AuthenticatedClient(AuthTestWebApplicationFactory factory)
    {
        factory.JtiValidator.IsValid = true;
        var client = factory.CreateClient();
        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", TestJwtTokens.CreateValid());
        return client;
    }

    private static object CreateBody(string content, string title = "Title", string? excerpt = null) => new
    {
        title,
        slug = "post-slug",
        content,
        excerpt,
        featuredImageUrl = (string?)null,
        status = "Draft",
        scheduledAt = (DateTime?)null,
        categoryId = (int?)null,
        templateId = 1,
        tagIds = Array.Empty<int>()
    };

    private static object UpdateBody(string content, string title = "Title", string? excerpt = null) => new
    {
        title,
        slug = "post-slug",
        content,
        excerpt,
        featuredImageUrl = (string?)null,
        status = "Draft",
        scheduledAt = (DateTime?)null,
        categoryId = (int?)null,
        templateId = 1,
        tagIds = Array.Empty<int>()
    };

    [Theory]
    [InlineData(
        "<p>hello</p><script>alert(1)</script>",
        "script")]
    [InlineData(
        "<img src=\"a.png\" onerror=\"alert(1)\">",
        "onerror")]
    [InlineData(
        "<a href=\"javascript:alert(1)\">click</a>",
        "javascript:")]
    [InlineData(
        "<img src=\"data:image/png;base64,AAAA\">",
        "data:image")]
    [InlineData(
        "<p onclick=\"doEvil()\">text</p>",
        "onclick")]
    [InlineData(
        "<style>body{background:red}</style><p style=\"color:red\">t</p>",
        "style")]
    [InlineData(
        "<scr<script>ipt>alert(1)</scr</script>ipt>",
        "<script")]
    public async Task CreatePost_HostileContent_PersistedValueIsNeutralized(
        string hostileContent,
        string mustNotContain)
    {
        using var factory = new AuthTestWebApplicationFactory();
        using var client = AuthenticatedClient(factory);

        var response = await client.PostAsJsonAsync("/api/posts", CreateBody(hostileContent));

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        Assert.NotNull(factory.PostRepository.CapturedCreate);
        Assert.DoesNotContain(
            mustNotContain,
            factory.PostRepository.CapturedCreate!.Content,
            StringComparison.OrdinalIgnoreCase);
    }

    [Theory]
    [InlineData("<p>hello</p><script>alert(1)</script>", "script")]
    [InlineData("<img src=\"a.png\" onerror=\"alert(1)\">", "onerror")]
    [InlineData("<a href=\"javascript:alert(1)\">click</a>", "javascript:")]
    public async Task UpdatePost_HostileContent_PersistedValueIsNeutralized(
        string hostileContent,
        string mustNotContain)
    {
        using var factory = new AuthTestWebApplicationFactory();
        factory.PostRepository.UpdateResult = new PostDto(
            1, "Title", "post-slug", "irrelevant", null, null, "Draft", null, null,
            null, null, 1, "article", "Article", [], DateTime.UtcNow, DateTime.UtcNow);
        using var client = AuthenticatedClient(factory);

        var response = await client.PutAsJsonAsync("/api/posts/1", UpdateBody(hostileContent));

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.NotNull(factory.PostRepository.CapturedUpdate);
        Assert.DoesNotContain(
            mustNotContain,
            factory.PostRepository.CapturedUpdate!.Content,
            StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task CreatePost_LegitimateRichContent_PersistedValuePassesThroughIntact()
    {
        using var factory = new AuthTestWebApplicationFactory();
        using var client = AuthenticatedClient(factory);
        const string html =
            "<h2>Title</h2><p>Some <strong>bold</strong> text.</p>" +
            "<ul><li>one</li></ul>" +
            "<a href=\"https://example.com\">link</a>" +
            "<img src=\"https://example.com/a.png\" alt=\"a\">" +
            "<pre><code class=\"language-csharp\">var x = 1;</code></pre>";

        var response = await client.PostAsJsonAsync("/api/posts", CreateBody(html));

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var persisted = factory.PostRepository.CapturedCreate!.Content;
        Assert.Contains("<h2>Title</h2>", persisted);
        Assert.Contains("<strong>bold</strong>", persisted);
        Assert.Contains("<li>one</li>", persisted);
        Assert.Contains("href=\"https://example.com\"", persisted);
        Assert.Contains("src=\"https://example.com/a.png\"", persisted);
        Assert.Contains("language-csharp", persisted);
    }

    [Fact]
    public async Task CreatePost_TitleAndExcerptWithTags_PersistedAsPlainText()
    {
        using var factory = new AuthTestWebApplicationFactory();
        using var client = AuthenticatedClient(factory);

        var response = await client.PostAsJsonAsync(
            "/api/posts",
            CreateBody(
                "<p>content</p>",
                title: "<b>Bold</b> <script>alert(1)</script>Title",
                excerpt: "<i>Italic</i> excerpt <img onerror=alert(1)>"));

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var captured = factory.PostRepository.CapturedCreate!;
        Assert.DoesNotContain("<", captured.Title);
        Assert.Contains("Bold", captured.Title);
        Assert.Contains("Title", captured.Title);
        Assert.NotNull(captured.Excerpt);
        Assert.DoesNotContain("<", captured.Excerpt);
        Assert.Contains("Italic", captured.Excerpt);
        Assert.Contains("excerpt", captured.Excerpt);
    }
}

/// <summary>
/// Consolidated boundary matrix for the #34 acceptance list. Each assertion
/// below is either new here or references (by comment) the existing test
/// that already covers it, so the full acceptance list is traceable from a
/// single class without duplicating coverage.
/// </summary>
public class Issue34BoundaryMatrixTests
{
    private static HttpClient AuthenticatedClient(AuthTestWebApplicationFactory factory)
    {
        factory.JtiValidator.IsValid = true;
        var client = factory.CreateClient();
        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", TestJwtTokens.CreateValid());
        return client;
    }

    // Unauthenticated mutation 401s (posts/categories/tags) — full matrix
    // already covered by AuthenticationTests.ProtectedEndpoint_NoToken_Returns401.
    // Spot-check one per resource here for traceability.
    [Theory]
    [InlineData("POST", "/api/posts")]
    [InlineData("POST", "/api/categories")]
    [InlineData("POST", "/api/tags")]
    public async Task UnauthenticatedMutation_Returns401(string method, string path)
    {
        using var factory = new AuthTestWebApplicationFactory();
        using var client = factory.CreateClient();

        var response = await client.SendAsync(new HttpRequestMessage(new HttpMethod(method), path));

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    // Invalid catalog TemplateId 400 — already covered at the service
    // level by PostServiceTests.CreateAsync_UnknownTemplateId_ReturnsTemplateValidationFailure
    // and CreateAsync_MissingTemplateId_ReturnsTemplateValidationFailure.
    // Verified here end to end through the HTTP pipeline (a missing
    // TemplateId exercises the same "post.template_invalid" branch as an
    // unknown one — the harness's fake catalog repository always reports
    // "exists" regardless of id, so a missing id is the deterministic way
    // to hit this branch through the real HTTP pipeline without adding
    // per-id behavior to the shared fake).
    [Fact]
    public async Task CreatePost_MissingTemplateId_Returns400()
    {
        using var factory = new AuthTestWebApplicationFactory();
        using var client = AuthenticatedClient(factory);

        var response = await client.PostAsJsonAsync(
            "/api/posts",
            new
            {
                title = "Title",
                slug = "title",
                content = "Content",
                status = "Draft",
                templateId = (int?)null,
                tagIds = Array.Empty<int>()
            });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    // Unknown TagIds 400 — already covered end to end by
    // TaxonomyMutationTests.CreatePost_UnknownTagIds_Returns400. Not
    // duplicated here.

    // Anonymous draft read 404 — already covered end to end by
    // PublicPostReadsTests.GetById_Anonymous_NonPublishedPost_Returns404
    // (Theory over Draft/Scheduled/Archived) and the slug equivalent. Not
    // duplicated here.

    // Schedule-from-published 409 — already covered end to end by
    // PostLifecycleTests.Schedule_WrongState_Returns409. Not duplicated here.
}
