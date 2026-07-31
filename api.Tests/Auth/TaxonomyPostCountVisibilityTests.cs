using System.Net;
using System.Net.Http.Headers;
using BlogSite.Api.DTOs;

namespace BlogSite.Api.Tests.Auth;

/// <summary>
/// Verifies the identity-branched taxonomy post counts (final branch
/// review, finding 3): anonymous callers of the [AllowAnonymous] taxonomy
/// GETs must only ever see Published-post counts, while authenticated admin
/// callers keep all-status counts — including the delete path, whose
/// referenced-protection depends on counting drafts.
/// </summary>
public class TaxonomyPostCountVisibilityTests
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
    public async Task GetCategories_Anonymous_RequestsPublishedOnlyCounts()
    {
        using var factory = new AuthTestWebApplicationFactory();
        using var client = factory.CreateClient();

        var response = await client.GetAsync("/api/categories");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.True(factory.CategoryRepository.CapturedGetAllPublishedOnly);
    }

    [Fact]
    public async Task GetCategories_Authenticated_RequestsAllStatusCounts()
    {
        using var factory = new AuthTestWebApplicationFactory();
        using var client = AuthenticatedClient(factory);

        var response = await client.GetAsync("/api/categories");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.False(factory.CategoryRepository.CapturedGetAllPublishedOnly);
    }

    [Fact]
    public async Task GetCategoryById_Anonymous_RequestsPublishedOnlyCount()
    {
        using var factory = new AuthTestWebApplicationFactory();
        factory.CategoryRepository.GetByIdResult = new CategoryDto(
            1, "News", "news", null, 0, DateTime.UtcNow, DateTime.UtcNow);
        using var client = factory.CreateClient();

        var response = await client.GetAsync("/api/categories/1");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.True(factory.CategoryRepository.CapturedGetByIdPublishedOnly);
    }

    [Fact]
    public async Task GetTags_Anonymous_RequestsPublishedOnlyCounts()
    {
        using var factory = new AuthTestWebApplicationFactory();
        using var client = factory.CreateClient();

        var response = await client.GetAsync("/api/tags");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.True(factory.TagRepository.CapturedGetAllPublishedOnly);
    }

    [Fact]
    public async Task GetTags_Authenticated_RequestsAllStatusCounts()
    {
        using var factory = new AuthTestWebApplicationFactory();
        using var client = AuthenticatedClient(factory);

        var response = await client.GetAsync("/api/tags");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.False(factory.TagRepository.CapturedGetAllPublishedOnly);
    }

    [Fact]
    public async Task GetTagById_Anonymous_RequestsPublishedOnlyCount()
    {
        using var factory = new AuthTestWebApplicationFactory();
        factory.TagRepository.GetByIdResult = new TagDto(
            1, "Tag", "tag", 0, DateTime.UtcNow);
        using var client = factory.CreateClient();

        var response = await client.GetAsync("/api/tags/1");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.True(factory.TagRepository.CapturedGetByIdPublishedOnly);
    }

    [Fact]
    public async Task DeleteCategory_UsesAllStatusCountsForReferencedProtection()
    {
        using var factory = new AuthTestWebApplicationFactory();
        factory.CategoryRepository.GetByIdResult = new CategoryDto(
            1, "News", "news", null, 2, DateTime.UtcNow, DateTime.UtcNow);
        using var client = AuthenticatedClient(factory);

        var response = await client.DeleteAsync("/api/categories/1");

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
        Assert.False(factory.CategoryRepository.CapturedGetByIdPublishedOnly);
    }

    [Fact]
    public async Task DeleteTag_UsesAllStatusCountsForReferencedProtection()
    {
        using var factory = new AuthTestWebApplicationFactory();
        factory.TagRepository.GetByIdResult = new TagDto(
            1, "Tag", "tag", 2, DateTime.UtcNow);
        using var client = AuthenticatedClient(factory);

        var response = await client.DeleteAsync("/api/tags/1");

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
        Assert.False(factory.TagRepository.CapturedGetByIdPublishedOnly);
    }
}
