using System.Text.Json;
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
        Task.FromResult<PostDto?>(null);
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
    public Task<IReadOnlyList<LayoutTemplateSummaryDto>> GetAllAsync(
        CancellationToken cancellationToken) =>
        Task.FromResult<IReadOnlyList<LayoutTemplateSummaryDto>>([]);

    public Task<LayoutTemplateDto?> GetByIdAsync(int id, CancellationToken cancellationToken) =>
        Task.FromResult<LayoutTemplateDto?>(null);

    public Task<LayoutTemplateDto> CreateAsync(
        string name,
        string description,
        JsonElement layout,
        bool isDefault,
        CancellationToken cancellationToken) =>
        throw new NotSupportedException("Not needed for auth tests.");

    public Task<LayoutTemplateDto?> UpdateAsync(
        int id,
        string name,
        string description,
        JsonElement layout,
        bool isDefault,
        CancellationToken cancellationToken) =>
        Task.FromResult<LayoutTemplateDto?>(null);

    public Task<bool> DeleteAsync(int id, CancellationToken cancellationToken) =>
        Task.FromResult(false);
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
