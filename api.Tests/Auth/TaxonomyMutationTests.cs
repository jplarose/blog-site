using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using BlogSite.Api.DTOs;

namespace BlogSite.Api.Tests.Auth;

/// <summary>
/// Exercises the category and tag admin failure matrix (issue #32) end to
/// end through the real controller/service pipeline with stubbed
/// repositories: duplicate name/slug, invalid slug format, delete when
/// referenced by posts, and missing id, for both taxonomies.
/// </summary>
public class TaxonomyMutationTests
{
    private static HttpClient AuthenticatedClient(AuthTestWebApplicationFactory factory)
    {
        factory.JtiValidator.IsValid = true;
        var client = factory.CreateClient();
        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", TestJwtTokens.CreateValid());
        return client;
    }

    private static CategoryDto SampleCategory(int postCount = 0) => new(
        1, "News", "news", null, postCount, DateTime.UtcNow, DateTime.UtcNow);

    private static TagDto SampleTag(int postCount = 0) => new(
        1, "Tag", "tag", postCount, DateTime.UtcNow);

    [Fact]
    public async Task CreateCategory_DuplicateSlug_Returns409()
    {
        using var factory = new AuthTestWebApplicationFactory();
        factory.CategoryRepository.SlugExists = true;
        using var client = AuthenticatedClient(factory);

        var response = await client.PostAsJsonAsync(
            "/api/categories",
            new { name = "News", slug = "news", description = (string?)null });

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
    }

    [Fact]
    public async Task CreateCategory_InvalidSlug_Returns400()
    {
        using var factory = new AuthTestWebApplicationFactory();
        using var client = AuthenticatedClient(factory);

        var response = await client.PostAsJsonAsync(
            "/api/categories",
            new { name = "News", slug = "Not Safe", description = (string?)null });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task UpdateCategory_MissingId_Returns404()
    {
        using var factory = new AuthTestWebApplicationFactory();
        using var client = AuthenticatedClient(factory);

        var response = await client.PutAsJsonAsync(
            "/api/categories/999",
            new { name = "News", slug = "news", description = (string?)null });

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task DeleteCategory_ReferencedByPosts_Returns409()
    {
        using var factory = new AuthTestWebApplicationFactory();
        factory.CategoryRepository.GetByIdResult = SampleCategory(postCount: 2);
        using var client = AuthenticatedClient(factory);

        var response = await client.DeleteAsync("/api/categories/1");

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
    }

    [Fact]
    public async Task DeleteCategory_MissingId_Returns404()
    {
        using var factory = new AuthTestWebApplicationFactory();
        using var client = AuthenticatedClient(factory);

        var response = await client.DeleteAsync("/api/categories/999");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task DeleteCategory_NotReferenced_Returns204()
    {
        using var factory = new AuthTestWebApplicationFactory();
        factory.CategoryRepository.GetByIdResult = SampleCategory(postCount: 0);
        factory.CategoryRepository.DeleteResult = true;
        using var client = AuthenticatedClient(factory);

        var response = await client.DeleteAsync("/api/categories/1");

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
    }

    [Fact]
    public async Task CreateTag_DuplicateSlug_Returns409()
    {
        using var factory = new AuthTestWebApplicationFactory();
        factory.TagRepository.SlugExists = true;
        using var client = AuthenticatedClient(factory);

        var response = await client.PostAsJsonAsync(
            "/api/tags",
            new { name = "Tag", slug = "tag" });

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
    }

    [Fact]
    public async Task CreateTag_InvalidSlug_Returns400()
    {
        using var factory = new AuthTestWebApplicationFactory();
        using var client = AuthenticatedClient(factory);

        var response = await client.PostAsJsonAsync(
            "/api/tags",
            new { name = "Tag", slug = "Not Safe" });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task UpdateTag_MissingId_Returns404()
    {
        using var factory = new AuthTestWebApplicationFactory();
        using var client = AuthenticatedClient(factory);

        var response = await client.PutAsJsonAsync(
            "/api/tags/999",
            new { name = "Tag", slug = "tag" });

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task DeleteTag_AttachedToPosts_Returns409()
    {
        using var factory = new AuthTestWebApplicationFactory();
        factory.TagRepository.GetByIdResult = SampleTag(postCount: 3);
        using var client = AuthenticatedClient(factory);

        var response = await client.DeleteAsync("/api/tags/1");

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
    }

    [Fact]
    public async Task DeleteTag_MissingId_Returns404()
    {
        using var factory = new AuthTestWebApplicationFactory();
        using var client = AuthenticatedClient(factory);

        var response = await client.DeleteAsync("/api/tags/999");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task DeleteTag_NotAttached_Returns204()
    {
        using var factory = new AuthTestWebApplicationFactory();
        factory.TagRepository.GetByIdResult = SampleTag(postCount: 0);
        factory.TagRepository.DeleteResult = true;
        using var client = AuthenticatedClient(factory);

        var response = await client.DeleteAsync("/api/tags/1");

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
    }

    [Fact]
    public async Task CreatePost_UnknownTagIds_Returns400()
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
                templateId = 1,
                tagIds = new[] { 999 }
            });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }
}
