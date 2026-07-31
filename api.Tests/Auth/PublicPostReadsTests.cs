using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using BlogSite.Api.DTOs;

namespace BlogSite.Api.Tests.Auth;

/// <summary>
/// Exercises the identity-branching contract from issue #33: anonymous
/// callers only ever see Published posts through the shared read routes
/// (<c>GET /api/posts</c>, <c>/{id}</c>, <c>/slug/{slug}</c>), while
/// authenticated admin callers keep the full, unrestricted behavior. Draft,
/// Scheduled, and Archived posts must 404 (not 403) for anonymous callers so
/// existence is never leaked.
/// </summary>
public class PublicPostReadsTests
{
    private static PostDto DetailPost(int id, string slug, string status) => new(
        id,
        "Title " + id,
        slug,
        "Full content",
        "Excerpt",
        "https://example.com/image.png",
        status,
        status == "Published" ? DateTime.UtcNow.AddDays(-1) : null,
        status == "Scheduled" ? DateTime.UtcNow.AddDays(1) : null,
        1,
        "Category",
        1,
        "article",
        "Article",
        ["tag-a"],
        DateTime.UtcNow,
        DateTime.UtcNow);

    private static PostSummaryDto SummaryPost(int id, string status) => new(
        id,
        "Title " + id,
        "slug-" + id,
        "Excerpt",
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
    public async Task List_Anonymous_DefaultQuery_ReturnsOnlyPublished()
    {
        using var factory = new AuthTestWebApplicationFactory();
        factory.PostRepository.AllPosts =
        [
            SummaryPost(1, "Published"),
            SummaryPost(2, "Draft"),
        ];
        using var client = factory.CreateClient();

        var response = await client.GetAsync("/api/posts");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var posts = await response.Content.ReadFromJsonAsync<List<PostSummaryDto>>();
        Assert.Single(posts!);
        Assert.Equal("Published", posts![0].Status);
    }

    [Fact]
    public async Task List_Anonymous_StatusFilterOverridden_ReturnsOnlyPublished()
    {
        using var factory = new AuthTestWebApplicationFactory();
        factory.PostRepository.AllPosts =
        [
            SummaryPost(1, "Published"),
            SummaryPost(2, "Draft"),
        ];
        using var client = factory.CreateClient();

        var response = await client.GetAsync("/api/posts?status=Draft");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var posts = await response.Content.ReadFromJsonAsync<List<PostSummaryDto>>();
        Assert.Single(posts!);
        Assert.Equal("Published", posts![0].Status);
    }

    [Fact]
    public async Task List_Authenticated_StatusFilterHonored_ReturnsDrafts()
    {
        using var factory = new AuthTestWebApplicationFactory();
        factory.PostRepository.AllPosts =
        [
            SummaryPost(1, "Published"),
            SummaryPost(2, "Draft"),
        ];
        using var client = AuthenticatedClient(factory);

        var response = await client.GetAsync("/api/posts?status=Draft");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var posts = await response.Content.ReadFromJsonAsync<List<PostSummaryDto>>();
        Assert.Single(posts!);
        Assert.Equal("Draft", posts![0].Status);
    }

    [Theory]
    [InlineData("Draft")]
    [InlineData("Scheduled")]
    [InlineData("Archived")]
    public async Task GetById_Anonymous_NonPublishedPost_Returns404(string status)
    {
        using var factory = new AuthTestWebApplicationFactory();
        factory.PostRepository.AllDetailPosts = [DetailPost(1, "post-1", status)];
        using var client = factory.CreateClient();

        var response = await client.GetAsync("/api/posts/1");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task GetById_Anonymous_PublishedPost_Returns200WithRendererFields()
    {
        using var factory = new AuthTestWebApplicationFactory();
        factory.PostRepository.AllDetailPosts = [DetailPost(1, "post-1", "Published")];
        using var client = factory.CreateClient();

        var response = await client.GetAsync("/api/posts/1");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var post = await response.Content.ReadFromJsonAsync<PostDto>();
        Assert.NotNull(post);
        Assert.Equal("Title 1", post!.Title);
        Assert.Equal("post-1", post.Slug);
        Assert.Equal("Full content", post.Content);
        Assert.Equal("Excerpt", post.Excerpt);
        Assert.Equal("https://example.com/image.png", post.FeaturedImageUrl);
        Assert.NotNull(post.PublishedAt);
        Assert.Equal("Category", post.CategoryName);
        Assert.Equal(["tag-a"], post.Tags);
        Assert.Equal(1, post.TemplateId);
    }

    [Fact]
    public async Task GetById_Authenticated_DraftPost_Returns200()
    {
        using var factory = new AuthTestWebApplicationFactory();
        factory.PostRepository.AllDetailPosts = [DetailPost(1, "post-1", "Draft")];
        using var client = AuthenticatedClient(factory);

        var response = await client.GetAsync("/api/posts/1");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var post = await response.Content.ReadFromJsonAsync<PostDto>();
        Assert.Equal("Draft", post!.Status);
    }

    [Theory]
    [InlineData("Draft")]
    [InlineData("Scheduled")]
    [InlineData("Archived")]
    public async Task GetBySlug_Anonymous_NonPublishedPost_Returns404(string status)
    {
        using var factory = new AuthTestWebApplicationFactory();
        factory.PostRepository.AllDetailPosts = [DetailPost(1, "post-1", status)];
        using var client = factory.CreateClient();

        var response = await client.GetAsync("/api/posts/slug/post-1");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task GetBySlug_Anonymous_PublishedPost_Returns200()
    {
        using var factory = new AuthTestWebApplicationFactory();
        factory.PostRepository.AllDetailPosts = [DetailPost(1, "post-1", "Published")];
        using var client = factory.CreateClient();

        var response = await client.GetAsync("/api/posts/slug/post-1");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var post = await response.Content.ReadFromJsonAsync<PostDto>();
        Assert.Equal("Published", post!.Status);
    }

    [Fact]
    public async Task GetBySlug_Authenticated_DraftPost_Returns200()
    {
        using var factory = new AuthTestWebApplicationFactory();
        factory.PostRepository.AllDetailPosts = [DetailPost(1, "post-1", "Draft")];
        using var client = AuthenticatedClient(factory);

        var response = await client.GetAsync("/api/posts/slug/post-1");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var post = await response.Content.ReadFromJsonAsync<PostDto>();
        Assert.Equal("Draft", post!.Status);
    }
}
