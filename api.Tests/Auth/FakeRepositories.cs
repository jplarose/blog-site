using BlogSite.Api.DTOs;
using BlogSite.Api.Repositories;

namespace BlogSite.Api.Tests.Auth;

/// <summary>
/// Minimal in-memory repository fakes used by the authentication
/// integration tests so requests can reach controller actions without a
/// real database.
/// </summary>
internal sealed class FakePostRepository : IPostRepository
{
    /// <summary>Configurable result returned by <see cref="PublishAsync"/>.</summary>
    public PostDto? PublishResult { get; set; }

    /// <summary>Configurable result returned by <see cref="ScheduleAsync"/>.</summary>
    public PostDto? ScheduleResult { get; set; }

    /// <summary>Configurable result returned by <see cref="ArchiveAsync"/>.</summary>
    public PostDto? ArchiveResult { get; set; }

    /// <summary>Configurable result returned by <see cref="ExistsAsync"/>.</summary>
    public bool ExistsResult { get; set; }

    /// <summary>Configurable result returned by <see cref="CreateAsync"/>.</summary>
    public PostDto CreateResult { get; set; } = new(
        1, "Title", "title", "Content", null, null, "Draft", null, null,
        null, null, null, null, null, [], DateTime.UtcNow, DateTime.UtcNow);

    /// <summary>
    /// The <see cref="PostWrite"/> value that reached the repository via
    /// <see cref="CreateAsync"/> — captured so tests can assert the
    /// persisted value (post-sanitization), not just the HTTP response.
    /// </summary>
    public PostWrite? CapturedCreate { get; private set; }

    /// <summary>
    /// The <see cref="PostWrite"/> value that reached the repository via
    /// <see cref="UpdateAsync"/> — captured so tests can assert the
    /// persisted value (post-sanitization), not just the HTTP response.
    /// </summary>
    public PostWrite? CapturedUpdate { get; private set; }

    /// <summary>Configurable result returned by <see cref="UpdateAsync"/>.</summary>
    public PostDto? UpdateResult { get; set; }

    /// <summary>
    /// Backing store for <see cref="GetAllAsync"/>, filtered the same way the
    /// real SQL would: <see cref="PostListQuery.PublishedOnly"/> overrides
    /// any requested status filter to Published-only.
    /// </summary>
    public IReadOnlyList<PostSummaryDto> AllPosts { get; set; } = [];

    /// <summary>
    /// Backing store for <see cref="GetByIdAsync"/>/<see cref="GetBySlugAsync"/>,
    /// filtered by id/slug and, when <c>publishedOnly</c> is requested, by
    /// status — mirroring the real repository's SQL predicate.
    /// </summary>
    public IReadOnlyList<PostDto> AllDetailPosts { get; set; } = [];

    public Task<PostPage> GetAllAsync(PostListQuery query, CancellationToken cancellationToken)
    {
        var posts = AllPosts.AsEnumerable();

        if (query.PublishedOnly)
        {
            posts = posts.Where(post => post.Status == "Published");
        }
        else if (!string.IsNullOrWhiteSpace(query.Status))
        {
            posts = posts.Where(post => post.Status == query.Status);
        }

        var list = posts.ToList();
        return Task.FromResult(new PostPage(list, list.Count));
    }

    public Task<PostDto?> GetByIdAsync(int id, bool publishedOnly, CancellationToken cancellationToken)
    {
        var post = AllDetailPosts.FirstOrDefault(post => post.Id == id);
        if (post is null || (publishedOnly && post.Status != "Published"))
        {
            return Task.FromResult<PostDto?>(null);
        }

        return Task.FromResult<PostDto?>(post);
    }

    public Task<PostDto?> GetBySlugAsync(string slug, bool publishedOnly, CancellationToken cancellationToken)
    {
        var post = AllDetailPosts.FirstOrDefault(post => post.Slug == slug);
        if (post is null || (publishedOnly && post.Status != "Published"))
        {
            return Task.FromResult<PostDto?>(null);
        }

        return Task.FromResult<PostDto?>(post);
    }

    public Task<PostDto> CreateAsync(PostWrite post, CancellationToken cancellationToken)
    {
        CapturedCreate = post;
        return Task.FromResult(CreateResult);
    }

    public Task<PostDto?> UpdateAsync(int id, PostWrite post, CancellationToken cancellationToken)
    {
        CapturedUpdate = post;
        return Task.FromResult<PostDto?>(UpdateResult);
    }

    public Task<bool> DeleteAsync(int id, CancellationToken cancellationToken) =>
        Task.FromResult(false);

    public Task<PostDto?> PublishAsync(int id, CancellationToken cancellationToken) =>
        Task.FromResult(PublishResult);

    public Task<bool> ExistsAsync(int id, CancellationToken cancellationToken) =>
        Task.FromResult(ExistsResult);

    public Task<PostDto?> ScheduleAsync(
        int id,
        DateTime scheduledAt,
        CancellationToken cancellationToken) =>
        Task.FromResult(ScheduleResult);

    public Task<PostDto?> ArchiveAsync(int id, CancellationToken cancellationToken) =>
        Task.FromResult(ArchiveResult);
}

internal sealed class FakeCategoryRepository : ICategoryRepository
{
    /// <summary>Configurable result returned by <see cref="GetByIdAsync"/>.</summary>
    public CategoryDto? GetByIdResult { get; set; }

    /// <summary>Configurable result returned by <see cref="NameExistsAsync"/>.</summary>
    public bool NameExists { get; set; }

    /// <summary>Configurable result returned by <see cref="SlugExistsAsync"/>.</summary>
    public bool SlugExists { get; set; }

    /// <summary>Configurable result returned by <see cref="UpdateAsync"/>.</summary>
    public CategoryDto? UpdateResult { get; set; }

    /// <summary>Configurable result returned by <see cref="DeleteAsync"/>.</summary>
    public bool DeleteResult { get; set; }

    public Task<IReadOnlyList<CategoryDto>> GetAllAsync(CancellationToken cancellationToken) =>
        Task.FromResult<IReadOnlyList<CategoryDto>>([]);

    public Task<CategoryDto?> GetByIdAsync(int id, CancellationToken cancellationToken) =>
        Task.FromResult(GetByIdResult);

    public Task<bool> NameExistsAsync(
        string name,
        int? excludeId,
        CancellationToken cancellationToken) =>
        Task.FromResult(NameExists);

    public Task<bool> SlugExistsAsync(
        string slug,
        int? excludeId,
        CancellationToken cancellationToken) =>
        Task.FromResult(SlugExists);

    public Task<CategoryDto> CreateAsync(
        string name,
        string slug,
        string? description,
        CancellationToken cancellationToken) =>
        throw new NotSupportedException("Not needed for auth tests.");

    public Task<CategoryDto?> UpdateAsync(
        int id,
        string name,
        string slug,
        string? description,
        CancellationToken cancellationToken) =>
        Task.FromResult(UpdateResult);

    public Task<bool> DeleteAsync(int id, CancellationToken cancellationToken) =>
        Task.FromResult(DeleteResult);
}

internal sealed class FakeTagRepository : ITagRepository
{
    /// <summary>Configurable result returned by <see cref="GetByIdAsync"/>.</summary>
    public TagDto? GetByIdResult { get; set; }

    /// <summary>Configurable result returned by <see cref="NameExistsAsync"/>.</summary>
    public bool NameExists { get; set; }

    /// <summary>Configurable result returned by <see cref="SlugExistsAsync"/>.</summary>
    public bool SlugExists { get; set; }

    /// <summary>Configurable result returned by <see cref="UpdateAsync"/>.</summary>
    public TagDto? UpdateResult { get; set; }

    /// <summary>Configurable result returned by <see cref="DeleteAsync"/>.</summary>
    public bool DeleteResult { get; set; }

    /// <summary>
    /// Tag ids treated as existing by <see cref="GetExistingIdsAsync"/>.
    /// Empty by default, so post-write tag validation fails closed unless a
    /// test explicitly seeds known ids.
    /// </summary>
    public IReadOnlyList<int> ExistingIds { get; set; } = [];

    public Task<IReadOnlyList<TagDto>> GetAllAsync(CancellationToken cancellationToken) =>
        Task.FromResult<IReadOnlyList<TagDto>>([]);

    public Task<TagDto?> GetByIdAsync(int id, CancellationToken cancellationToken) =>
        Task.FromResult(GetByIdResult);

    public Task<bool> NameExistsAsync(
        string name,
        int? excludeId,
        CancellationToken cancellationToken) =>
        Task.FromResult(NameExists);

    public Task<bool> SlugExistsAsync(
        string slug,
        int? excludeId,
        CancellationToken cancellationToken) =>
        Task.FromResult(SlugExists);

    public Task<TagDto> CreateAsync(string name, string slug, CancellationToken cancellationToken) =>
        throw new NotSupportedException("Not needed for auth tests.");

    public Task<TagDto?> UpdateAsync(
        int id,
        string name,
        string slug,
        CancellationToken cancellationToken) =>
        Task.FromResult(UpdateResult);

    public Task<bool> DeleteAsync(int id, CancellationToken cancellationToken) =>
        Task.FromResult(DeleteResult);

    public Task<IReadOnlyList<int>> GetExistingIdsAsync(
        IReadOnlyList<int> ids,
        CancellationToken cancellationToken) =>
        Task.FromResult<IReadOnlyList<int>>(ids.Where(ExistingIds.Contains).ToList());
}

internal sealed class FakeLayoutTemplateRepository : ILayoutTemplateRepository
{
    public bool ExistsResult { get; init; } = true;

    /// <summary>
    /// A single stand-in catalog row, keyed by id 1, so tests can fetch a
    /// non-null template detail without a database.
    /// </summary>
    private static readonly LayoutTemplateDto SeededTemplate = new(
        1,
        "article",
        "Article",
        "Standard long-form post layout.",
        "<article>{{content}}</article>",
        ".tpl-article { max-width: 720px; }");

    public Task<IReadOnlyList<LayoutTemplateSummaryDto>> GetAllAsync(
        CancellationToken cancellationToken) =>
        Task.FromResult<IReadOnlyList<LayoutTemplateSummaryDto>>(
        [
            new LayoutTemplateSummaryDto(
                SeededTemplate.Id,
                SeededTemplate.TemplateKey,
                SeededTemplate.Name,
                SeededTemplate.Description)
        ]);

    public Task<LayoutTemplateDto?> GetByIdAsync(int id, CancellationToken cancellationToken) =>
        Task.FromResult(id == SeededTemplate.Id ? SeededTemplate : null);

    public Task<bool> ExistsAsync(int id, CancellationToken cancellationToken) =>
        Task.FromResult(ExistsResult);
}

internal sealed class FakeAnalyticsRepository : IAnalyticsRepository
{
    public Task<AnalyticsSummaryDto> GetSummaryAsync(DateTime since, CancellationToken cancellationToken) =>
        Task.FromResult(new AnalyticsSummaryDto(0, 0, 0, 0, 0, [], []));

    public Task RecordPageViewAsync(
        int? postId,
        string path,
        string? ipAddress,
        string? userAgent,
        string? referrer,
        CancellationToken cancellationToken) =>
        Task.CompletedTask;
}
