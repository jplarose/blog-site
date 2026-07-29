using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using BlogSite.Api.DTOs;

namespace BlogSite.Api.Tests.Auth;

/// <summary>
/// Verifies the full authoring-to-publication chain in a single sequential
/// flow — create with a catalog template, schedule, publish, then confirm
/// an anonymous caller can read it — rather than exercising each lifecycle
/// transition in isolation (see <see cref="PostLifecycleTests"/> and
/// <see cref="PublicPostReadsTests"/> for the per-step coverage this test
/// composes). Also confirms the mirror image: an anonymous caller 404s on
/// the same post while it sits in Draft, Scheduled, or Archived state.
/// </summary>
public class PostFlowChainTests
{
    private static HttpClient AuthenticatedClient(AuthTestWebApplicationFactory factory)
    {
        factory.JtiValidator.IsValid = true;
        var client = factory.CreateClient();
        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", TestJwtTokens.CreateValid());
        return client;
    }

    private static object CreateBody() => new
    {
        title = "Chain Post",
        slug = "chain-post",
        content = "<p>Full lifecycle content.</p>",
        excerpt = (string?)null,
        featuredImageUrl = (string?)null,
        status = "Draft",
        scheduledAt = (DateTime?)null,
        categoryId = (int?)null,
        templateId = 1,
        tagIds = Array.Empty<int>()
    };

    private static PostDto PostAt(string status) => new(
        1,
        "Chain Post",
        "chain-post",
        "<p>Full lifecycle content.</p>",
        null,
        null,
        status,
        status == "Published" ? DateTime.UtcNow : null,
        status == "Scheduled" ? DateTime.UtcNow.AddDays(1) : null,
        null,
        null,
        1,
        "article",
        "Article",
        [],
        DateTime.UtcNow,
        DateTime.UtcNow);

    [Fact]
    public async Task CreateScheduleThenPublish_ThenAnonymousReadsSeeIt()
    {
        using var factory = new AuthTestWebApplicationFactory();
        using var authed = AuthenticatedClient(factory);
        using var anonymous = factory.CreateClient();

        // 1. Authenticated create against the catalog template.
        factory.PostRepository.CreateResult = PostAt("Draft");
        var createResponse = await authed.PostAsJsonAsync("/api/posts", CreateBody());
        Assert.Equal(HttpStatusCode.Created, createResponse.StatusCode);
        var created = await createResponse.Content.ReadFromJsonAsync<PostDto>();
        Assert.Equal(1, created!.TemplateId);
        Assert.Equal("Draft", created.Status);

        // Anonymous cannot see the Draft yet.
        factory.PostRepository.AllDetailPosts = [PostAt("Draft")];
        var draftRead = await anonymous.GetAsync("/api/posts/slug/chain-post");
        Assert.Equal(HttpStatusCode.NotFound, draftRead.StatusCode);

        // 2. Authenticated schedule.
        factory.PostRepository.ScheduleResult = PostAt("Scheduled");
        var scheduleResponse = await authed.PostAsJsonAsync(
            "/api/posts/1/schedule",
            new { scheduledAt = DateTime.UtcNow.AddDays(1) });
        Assert.Equal(HttpStatusCode.OK, scheduleResponse.StatusCode);
        var scheduled = await scheduleResponse.Content.ReadFromJsonAsync<PostDto>();
        Assert.Equal("Scheduled", scheduled!.Status);

        // Anonymous still cannot see it while Scheduled.
        factory.PostRepository.AllDetailPosts = [PostAt("Scheduled")];
        var scheduledRead = await anonymous.GetAsync("/api/posts/slug/chain-post");
        Assert.Equal(HttpStatusCode.NotFound, scheduledRead.StatusCode);

        // 3. Authenticated publish.
        factory.PostRepository.PublishResult = PostAt("Published");
        var publishResponse = await authed.PostAsync("/api/posts/1/publish", null);
        Assert.Equal(HttpStatusCode.OK, publishResponse.StatusCode);
        var published = await publishResponse.Content.ReadFromJsonAsync<PostDto>();
        Assert.Equal("Published", published!.Status);

        // 4. Anonymous read now succeeds, by id and by slug.
        factory.PostRepository.AllDetailPosts = [PostAt("Published")];
        var idRead = await anonymous.GetAsync("/api/posts/1");
        Assert.Equal(HttpStatusCode.OK, idRead.StatusCode);
        var idPost = await idRead.Content.ReadFromJsonAsync<PostDto>();
        Assert.Equal("Published", idPost!.Status);

        var slugRead = await anonymous.GetAsync("/api/posts/slug/chain-post");
        Assert.Equal(HttpStatusCode.OK, slugRead.StatusCode);

        // Also confirm an Archived post remains hidden from anonymous reads.
        factory.PostRepository.AllDetailPosts = [PostAt("Archived")];
        var archivedRead = await anonymous.GetAsync("/api/posts/slug/chain-post");
        Assert.Equal(HttpStatusCode.NotFound, archivedRead.StatusCode);
    }
}
