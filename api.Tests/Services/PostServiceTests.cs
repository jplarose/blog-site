using BlogSite.Api.DTOs;
using BlogSite.Api.Repositories;
using BlogSite.Api.Services;

namespace BlogSite.Api.Tests.Services;

public class PostServiceTests
{
    [Fact]
    public async Task CreateAsync_InvalidStatus_ReturnsFailureWithoutWriting()
    {
        var repository = new FakePostRepository();
        var service = new PostService(
            repository,
            new FakeLayoutTemplateRepository(),
            new FakeTagRepository());

        var result = await service.CreateAsync(
            CreateRequest(status: "unknown"),
            CancellationToken.None);

        Assert.True(result.IsFailure);
        Assert.Equal("post.invalid_status", result.Error?.Code);
        Assert.Null(repository.CreatedPost);
    }

    [Fact]
    public async Task CreateAsync_MissingTemplateId_ReturnsTemplateValidationFailure()
    {
        var repository = new FakePostRepository();
        var service = new PostService(
            repository,
            new FakeLayoutTemplateRepository(),
            new FakeTagRepository());

        var result = await service.CreateAsync(
            CreateRequest(templateId: null),
            CancellationToken.None);

        Assert.True(result.IsFailure);
        Assert.Equal("post.template_invalid", result.Error?.Code);
        Assert.Equal(
            "TemplateId must reference an existing catalog template.",
            result.Error?.Message);
        Assert.Null(repository.CreatedPost);
    }

    [Fact]
    public async Task CreateAsync_UnknownTemplateId_ReturnsTemplateValidationFailure()
    {
        var repository = new FakePostRepository();
        var templates = new FakeLayoutTemplateRepository { Exists = false };
        var service = new PostService(repository, templates, new FakeTagRepository());

        var result = await service.CreateAsync(
            CreateRequest(templateId: 999),
            CancellationToken.None);

        Assert.True(result.IsFailure);
        Assert.Equal("post.template_invalid", result.Error?.Code);
        Assert.Null(repository.CreatedPost);
    }

    [Fact]
    public async Task CreateAsync_ValidTemplateId_NotBlockedByTemplateValidation()
    {
        var repository = new FakePostRepository
        {
            CreateResult = PostDto()
        };
        var templates = new FakeLayoutTemplateRepository { Exists = true };
        var service = new PostService(repository, templates, new FakeTagRepository());

        var result = await service.CreateAsync(
            CreateRequest(templateId: 1),
            CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.NotNull(repository.CreatedPost);
    }

    [Fact]
    public async Task CreateAsync_UnknownTagId_ReturnsTagValidationFailureWithoutWriting()
    {
        var repository = new FakePostRepository();
        var tags = new FakeTagRepository { ExistingIds = [1] };
        var service = new PostService(repository, new FakeLayoutTemplateRepository(), tags);

        var result = await service.CreateAsync(
            CreateRequest(tagIds: [1, 999]),
            CancellationToken.None);

        Assert.True(result.IsFailure);
        Assert.Equal("post.tag_invalid", result.Error?.Code);
        Assert.Contains("999", result.Error!.Message);
        Assert.Null(repository.CreatedPost);
    }

    [Fact]
    public async Task CreateAsync_ValidTagIds_WritesTagIdsToRepository()
    {
        var repository = new FakePostRepository
        {
            CreateResult = PostDto()
        };
        var tags = new FakeTagRepository { ExistingIds = [1, 2] };
        var service = new PostService(repository, new FakeLayoutTemplateRepository(), tags);

        var result = await service.CreateAsync(
            CreateRequest(tagIds: [1, 2]),
            CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.Equal([1, 2], repository.CreatedPost!.TagIds);
    }

    [Fact]
    public async Task UpdateAsync_MissingPost_ReturnsNotFound()
    {
        var repository = new FakePostRepository();
        var service = new PostService(
            repository,
            new FakeLayoutTemplateRepository(),
            new FakeTagRepository());

        var result = await service.UpdateAsync(
            42,
            UpdateRequest(),
            CancellationToken.None);

        Assert.True(result.IsFailure);
        Assert.Equal("post.not_found", result.Error?.Code);
    }

    [Fact]
    public async Task UpdateAsync_UnknownTemplateId_ReturnsTemplateValidationFailure()
    {
        var repository = new FakePostRepository();
        var templates = new FakeLayoutTemplateRepository { Exists = false };
        var service = new PostService(repository, templates, new FakeTagRepository());

        var result = await service.UpdateAsync(
            1,
            UpdateRequest(templateId: 999),
            CancellationToken.None);

        Assert.True(result.IsFailure);
        Assert.Equal("post.template_invalid", result.Error?.Code);
    }

    [Fact]
    public async Task UpdateAsync_UnknownTagId_ReturnsTagValidationFailure()
    {
        var repository = new FakePostRepository();
        var tags = new FakeTagRepository { ExistingIds = [] };
        var service = new PostService(repository, new FakeLayoutTemplateRepository(), tags);

        var result = await service.UpdateAsync(
            1,
            UpdateRequest(tagIds: [42]),
            CancellationToken.None);

        Assert.True(result.IsFailure);
        Assert.Equal("post.tag_invalid", result.Error?.Code);
    }

    [Fact]
    public async Task PublishAsync_ExistingPost_ReturnsRepositoryValue()
    {
        var expected = PostDto();
        var repository = new FakePostRepository
        {
            PublishResult = expected
        };
        var service = new PostService(repository, new FakeLayoutTemplateRepository(), new FakeTagRepository());

        var result = await service.PublishAsync(
            expected.Id,
            CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.Same(expected, result.Value);
    }

    [Fact]
    public async Task PublishAsync_MissingPost_ReturnsNotFound()
    {
        var repository = new FakePostRepository();
        var service = new PostService(repository, new FakeLayoutTemplateRepository(), new FakeTagRepository());

        var result = await service.PublishAsync(42, CancellationToken.None);

        Assert.True(result.IsFailure);
        Assert.Equal("post.not_found", result.Error?.Code);
    }

    [Fact]
    public async Task ScheduleAsync_MissingScheduledAt_ReturnsInvalidScheduleFailure()
    {
        var repository = new FakePostRepository();
        var service = new PostService(repository, new FakeLayoutTemplateRepository(), new FakeTagRepository());

        var result = await service.ScheduleAsync(
            1,
            new ScheduleRequest(null),
            CancellationToken.None);

        Assert.True(result.IsFailure);
        Assert.Equal("post.invalid_schedule", result.Error?.Code);
        Assert.Null(repository.ScheduleCapturedAt);
    }

    [Fact]
    public async Task ScheduleAsync_PastScheduledAt_ReturnsInvalidScheduleFailure()
    {
        var repository = new FakePostRepository();
        var service = new PostService(repository, new FakeLayoutTemplateRepository(), new FakeTagRepository());

        var result = await service.ScheduleAsync(
            1,
            new ScheduleRequest(DateTime.UtcNow.AddMinutes(-1)),
            CancellationToken.None);

        Assert.True(result.IsFailure);
        Assert.Equal("post.invalid_schedule", result.Error?.Code);
        Assert.Null(repository.ScheduleCapturedAt);
    }

    [Fact]
    public async Task ScheduleAsync_UnknownPost_ReturnsNotFound()
    {
        var repository = new FakePostRepository { ExistsResult = false };
        var service = new PostService(repository, new FakeLayoutTemplateRepository(), new FakeTagRepository());

        var result = await service.ScheduleAsync(
            1,
            new ScheduleRequest(DateTime.UtcNow.AddDays(1)),
            CancellationToken.None);

        Assert.True(result.IsFailure);
        Assert.Equal("post.not_found", result.Error?.Code);
    }

    [Fact]
    public async Task ScheduleAsync_PublishedPost_ReturnsInvalidTransitionFailure()
    {
        var repository = new FakePostRepository { ExistsResult = true };
        var service = new PostService(repository, new FakeLayoutTemplateRepository(), new FakeTagRepository());

        var result = await service.ScheduleAsync(
            1,
            new ScheduleRequest(DateTime.UtcNow.AddDays(1)),
            CancellationToken.None);

        Assert.True(result.IsFailure);
        Assert.Equal("post.invalid_transition", result.Error?.Code);
        Assert.Equal(
            "Only draft or scheduled posts can be scheduled.",
            result.Error?.Message);
    }

    [Fact]
    public async Task ScheduleAsync_FromDraft_Succeeds()
    {
        var expected = PostDto() with { Status = "Scheduled" };
        var repository = new FakePostRepository { ScheduleResult = expected };
        var service = new PostService(repository, new FakeLayoutTemplateRepository(), new FakeTagRepository());
        var scheduledAt = DateTime.UtcNow.AddDays(1);

        var result = await service.ScheduleAsync(
            1,
            new ScheduleRequest(scheduledAt),
            CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.Same(expected, result.Value);
        Assert.Equal(scheduledAt, repository.ScheduleCapturedAt);
    }

    [Fact]
    public async Task ScheduleAsync_FutureNonUtcOffset_IsAcceptedAndConvertedToUtc()
    {
        var expected = PostDto() with { Status = "Scheduled" };
        var repository = new FakePostRepository { ScheduleResult = expected };
        var service = new PostService(repository, new FakeLayoutTemplateRepository(), new FakeTagRepository());
        var scheduledAt = new DateTimeOffset(
            DateTime.SpecifyKind(DateTime.UtcNow.AddDays(1).Date.AddHours(14), DateTimeKind.Unspecified),
            TimeSpan.FromHours(2));

        var result = await service.ScheduleAsync(
            1,
            new ScheduleRequest(scheduledAt),
            CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.Same(expected, result.Value);
        Assert.Equal(scheduledAt.UtcDateTime, repository.ScheduleCapturedAt);
    }

    [Fact]
    public async Task ScheduleAsync_FromScheduled_ReSchedulesSucceeds()
    {
        var expected = PostDto() with { Status = "Scheduled" };
        var repository = new FakePostRepository { ScheduleResult = expected };
        var service = new PostService(repository, new FakeLayoutTemplateRepository(), new FakeTagRepository());
        var newScheduledAt = DateTime.UtcNow.AddDays(3);

        var result = await service.ScheduleAsync(
            1,
            new ScheduleRequest(newScheduledAt),
            CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.Same(expected, result.Value);
        Assert.Equal(newScheduledAt, repository.ScheduleCapturedAt);
    }

    [Fact]
    public async Task ArchiveAsync_MissingPost_ReturnsNotFound()
    {
        var repository = new FakePostRepository();
        var service = new PostService(repository, new FakeLayoutTemplateRepository(), new FakeTagRepository());

        var result = await service.ArchiveAsync(42, CancellationToken.None);

        Assert.True(result.IsFailure);
        Assert.Equal("post.not_found", result.Error?.Code);
    }

    [Fact]
    public async Task ArchiveAsync_ExistingPost_ReturnsRepositoryValue()
    {
        var expected = PostDto() with { Status = "Archived" };
        var repository = new FakePostRepository { ArchiveResult = expected };
        var service = new PostService(repository, new FakeLayoutTemplateRepository(), new FakeTagRepository());

        var result = await service.ArchiveAsync(expected.Id, CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.Same(expected, result.Value);
    }

    [Fact]
    public async Task ArchiveAsync_AlreadyArchivedPost_IsIdempotent()
    {
        var expected = PostDto() with { Status = "Archived" };
        var repository = new FakePostRepository { ArchiveResult = expected };
        var service = new PostService(repository, new FakeLayoutTemplateRepository(), new FakeTagRepository());

        var result = await service.ArchiveAsync(expected.Id, CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.Equal("Archived", result.Value?.Status);
    }

    private static CreatePostRequest CreateRequest(
        string status = "Draft",
        int? templateId = 1,
        IReadOnlyList<int>? tagIds = null) =>
        new(
            "Title",
            "title",
            "Content",
            null,
            null,
            status,
            null,
            null,
            templateId,
            tagIds ?? []);

    private static UpdatePostRequest UpdateRequest(
        int? templateId = 1,
        IReadOnlyList<int>? tagIds = null) =>
        new(
            "Title",
            "title",
            "Content",
            null,
            null,
            "Draft",
            null,
            null,
            templateId,
            tagIds ?? []);

    private static PostDto PostDto() =>
        new(
            1,
            "Title",
            "title",
            "Content",
            null,
            null,
            "Draft",
            null,
            null,
            null,
            null,
            1,
            "article",
            "Article",
            [],
            DateTime.UtcNow,
            DateTime.UtcNow);

    private sealed class FakeLayoutTemplateRepository : ILayoutTemplateRepository
    {
        public bool Exists { get; init; } = true;

        public Task<IReadOnlyList<LayoutTemplateSummaryDto>> GetAllAsync(
            CancellationToken cancellationToken) =>
            throw new NotSupportedException();

        public Task<LayoutTemplateDto?> GetByIdAsync(
            int id,
            CancellationToken cancellationToken) =>
            throw new NotSupportedException();

        public Task<bool> ExistsAsync(int id, CancellationToken cancellationToken) =>
            Task.FromResult(Exists);
    }

    private sealed class FakeTagRepository : ITagRepository
    {
        public IReadOnlyList<int> ExistingIds { get; init; } = [];

        public Task<IReadOnlyList<TagDto>> GetAllAsync(
            CancellationToken cancellationToken) =>
            throw new NotSupportedException();

        public Task<TagDto?> GetByIdAsync(int id, CancellationToken cancellationToken) =>
            throw new NotSupportedException();

        public Task<bool> NameExistsAsync(
            string name,
            int? excludeId,
            CancellationToken cancellationToken) =>
            throw new NotSupportedException();

        public Task<bool> SlugExistsAsync(
            string slug,
            int? excludeId,
            CancellationToken cancellationToken) =>
            throw new NotSupportedException();

        public Task<TagDto> CreateAsync(
            string name,
            string slug,
            CancellationToken cancellationToken) =>
            throw new NotSupportedException();

        public Task<TagDto?> UpdateAsync(
            int id,
            string name,
            string slug,
            CancellationToken cancellationToken) =>
            throw new NotSupportedException();

        public Task<bool> DeleteAsync(int id, CancellationToken cancellationToken) =>
            throw new NotSupportedException();

        public Task<IReadOnlyList<int>> GetExistingIdsAsync(
            IReadOnlyList<int> ids,
            CancellationToken cancellationToken) =>
            Task.FromResult<IReadOnlyList<int>>(
                ids.Where(ExistingIds.Contains).ToList());
    }

    private sealed class FakePostRepository : IPostRepository
    {
        public PostWrite? CreatedPost { get; private set; }
        public PostDto CreateResult { get; init; } = PostDto();
        public PostDto? UpdateResult { get; init; }
        public PostDto? PublishResult { get; init; }
        public PostDto? ScheduleResult { get; init; }
        public PostDto? ArchiveResult { get; init; }
        public bool ExistsResult { get; init; }
        public DateTime? ScheduleCapturedAt { get; private set; }

        public Task<PostPage> GetAllAsync(
            PostListQuery query,
            CancellationToken cancellationToken) =>
            throw new NotSupportedException();

        public Task<PostDto?> GetByIdAsync(
            int id,
            CancellationToken cancellationToken) =>
            throw new NotSupportedException();

        public Task<PostDto?> GetBySlugAsync(
            string slug,
            CancellationToken cancellationToken) =>
            throw new NotSupportedException();

        public Task<PostDto> CreateAsync(
            PostWrite post,
            CancellationToken cancellationToken)
        {
            CreatedPost = post;
            return Task.FromResult(CreateResult);
        }

        public Task<PostDto?> UpdateAsync(
            int id,
            PostWrite post,
            CancellationToken cancellationToken) =>
            Task.FromResult(UpdateResult);

        public Task<bool> DeleteAsync(
            int id,
            CancellationToken cancellationToken) =>
            Task.FromResult(false);

        public Task<PostDto?> PublishAsync(
            int id,
            CancellationToken cancellationToken) =>
            Task.FromResult(PublishResult);

        public Task<bool> ExistsAsync(int id, CancellationToken cancellationToken) =>
            Task.FromResult(ExistsResult);

        public Task<PostDto?> ScheduleAsync(
            int id,
            DateTime scheduledAt,
            CancellationToken cancellationToken)
        {
            ScheduleCapturedAt = scheduledAt;
            return Task.FromResult(ScheduleResult);
        }

        public Task<PostDto?> ArchiveAsync(
            int id,
            CancellationToken cancellationToken) =>
            Task.FromResult(ArchiveResult);
    }
}
