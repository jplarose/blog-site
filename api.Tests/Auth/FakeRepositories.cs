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

    public Task<PostPage> GetAllAsync(PostListQuery query, CancellationToken cancellationToken) =>
        Task.FromResult(new PostPage([], 0));

    public Task<PostDto?> GetByIdAsync(int id, CancellationToken cancellationToken) =>
        Task.FromResult<PostDto?>(null);

    public Task<PostDto?> GetBySlugAsync(string slug, CancellationToken cancellationToken) =>
        Task.FromResult<PostDto?>(null);

    public Task<PostDto> CreateAsync(PostWrite post, CancellationToken cancellationToken) =>
        throw new NotSupportedException("Not needed for auth tests.");

    public Task<PostDto?> UpdateAsync(int id, PostWrite post, CancellationToken cancellationToken) =>
        Task.FromResult<PostDto?>(null);

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
    public Task<IReadOnlyList<CategoryDto>> GetAllAsync(CancellationToken cancellationToken) =>
        Task.FromResult<IReadOnlyList<CategoryDto>>([]);

    public Task<CategoryDto?> GetByIdAsync(int id, CancellationToken cancellationToken) =>
        Task.FromResult<CategoryDto?>(null);

    public Task<CategoryDto> CreateAsync(
        string name,
        string slug,
        string? description,
        int? defaultTemplateId,
        CancellationToken cancellationToken) =>
        throw new NotSupportedException("Not needed for auth tests.");

    public Task<CategoryDto?> UpdateAsync(
        int id,
        string name,
        string slug,
        string? description,
        int? defaultTemplateId,
        CancellationToken cancellationToken) =>
        Task.FromResult<CategoryDto?>(null);

    public Task<bool> DeleteAsync(int id, CancellationToken cancellationToken) =>
        Task.FromResult(false);
}

internal sealed class FakeTagRepository : ITagRepository
{
    public Task<IReadOnlyList<TagDto>> GetAllAsync(CancellationToken cancellationToken) =>
        Task.FromResult<IReadOnlyList<TagDto>>([]);

    public Task<TagDto?> GetByIdAsync(int id, CancellationToken cancellationToken) =>
        Task.FromResult<TagDto?>(null);

    public Task<TagDto> CreateAsync(string name, string slug, CancellationToken cancellationToken) =>
        throw new NotSupportedException("Not needed for auth tests.");

    public Task<TagDto?> UpdateAsync(
        int id,
        string name,
        string slug,
        CancellationToken cancellationToken) =>
        Task.FromResult<TagDto?>(null);

    public Task<bool> DeleteAsync(int id, CancellationToken cancellationToken) =>
        Task.FromResult(false);
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
