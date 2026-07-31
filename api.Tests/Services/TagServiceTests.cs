using BlogSite.Api.DTOs;
using BlogSite.Api.Repositories;
using BlogSite.Api.Services;

namespace BlogSite.Api.Tests.Services;

public class TagServiceTests
{
    [Fact]
    public async Task CreateAsync_BlankName_ReturnsValidationFailure()
    {
        var repository = new FakeTagRepository();
        var service = new TagService(repository);

        var result = await service.CreateAsync(
            new CreateTagRequest(" ", "tag"),
            CancellationToken.None);

        Assert.True(result.IsFailure);
        Assert.Equal("tag.name_required", result.Error?.Code);
        Assert.False(repository.CreateCalled);
    }

    [Fact]
    public async Task CreateAsync_BlankSlug_ReturnsValidationFailure()
    {
        var repository = new FakeTagRepository();
        var service = new TagService(repository);

        var result = await service.CreateAsync(
            new CreateTagRequest("Tag", " "),
            CancellationToken.None);

        Assert.True(result.IsFailure);
        Assert.Equal("tag.slug_required", result.Error?.Code);
        Assert.False(repository.CreateCalled);
    }

    [Theory]
    [InlineData("Not Safe")]
    [InlineData("UPPERCASE")]
    [InlineData("trailing-")]
    [InlineData("has_underscore")]
    public async Task CreateAsync_SlugNotUrlSafe_ReturnsValidationFailure(string slug)
    {
        var repository = new FakeTagRepository();
        var service = new TagService(repository);

        var result = await service.CreateAsync(
            new CreateTagRequest("Tag", slug),
            CancellationToken.None);

        Assert.True(result.IsFailure);
        Assert.Equal("tag.slug_invalid", result.Error?.Code);
        Assert.False(repository.CreateCalled);
    }

    [Fact]
    public async Task CreateAsync_DuplicateName_ReturnsConflict()
    {
        var repository = new FakeTagRepository { NameExists = true };
        var service = new TagService(repository);

        var result = await service.CreateAsync(
            new CreateTagRequest("Tag", "tag"),
            CancellationToken.None);

        Assert.True(result.IsFailure);
        Assert.Equal("tag.duplicate_name", result.Error?.Code);
        Assert.False(repository.CreateCalled);
    }

    [Fact]
    public async Task CreateAsync_DuplicateSlug_ReturnsConflict()
    {
        var repository = new FakeTagRepository { SlugExists = true };
        var service = new TagService(repository);

        var result = await service.CreateAsync(
            new CreateTagRequest("Tag", "tag"),
            CancellationToken.None);

        Assert.True(result.IsFailure);
        Assert.Equal("tag.duplicate_slug", result.Error?.Code);
        Assert.False(repository.CreateCalled);
    }

    [Fact]
    public async Task UpdateAsync_MissingTag_ReturnsNotFound()
    {
        var repository = new FakeTagRepository();
        var service = new TagService(repository);

        var result = await service.UpdateAsync(
            42,
            new UpdateTagRequest("Tag", "tag"),
            CancellationToken.None);

        Assert.True(result.IsFailure);
        Assert.Equal("tag.not_found", result.Error?.Code);
    }

    [Fact]
    public async Task UpdateAsync_DuplicateSlugOnAnotherTag_ReturnsConflict()
    {
        var repository = new FakeTagRepository { SlugExists = true };
        var service = new TagService(repository);

        var result = await service.UpdateAsync(
            42,
            new UpdateTagRequest("Tag", "tag"),
            CancellationToken.None);

        Assert.True(result.IsFailure);
        Assert.Equal("tag.duplicate_slug", result.Error?.Code);
        Assert.Equal(42, repository.ExcludeIdSeen);
    }

    [Fact]
    public async Task DeleteAsync_MissingTag_ReturnsNotFound()
    {
        var repository = new FakeTagRepository { GetByIdResult = null };
        var service = new TagService(repository);

        var result = await service.DeleteAsync(1, CancellationToken.None);

        Assert.True(result.IsFailure);
        Assert.Equal("tag.not_found", result.Error?.Code);
    }

    [Fact]
    public async Task DeleteAsync_AttachedToPosts_ReturnsConflictWithoutDeleting()
    {
        var repository = new FakeTagRepository
        {
            GetByIdResult = Tag() with { PostCount = 2 }
        };
        var service = new TagService(repository);

        var result = await service.DeleteAsync(1, CancellationToken.None);

        Assert.True(result.IsFailure);
        Assert.Equal("tag.referenced", result.Error?.Code);
        Assert.False(repository.DeleteCalled);
    }

    [Fact]
    public async Task DeleteAsync_NotAttachedToPosts_ReturnsSuccess()
    {
        var repository = new FakeTagRepository
        {
            GetByIdResult = Tag() with { PostCount = 0 },
            DeleteResult = true
        };
        var service = new TagService(repository);

        var result = await service.DeleteAsync(
            1,
            CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.True(repository.DeleteCalled);
    }

    private static TagDto Tag() => new(1, "Tag", "tag", 0, DateTime.UtcNow);

    private sealed class FakeTagRepository : ITagRepository
    {
        public bool CreateCalled { get; private set; }
        public bool DeleteCalled { get; private set; }
        public int? ExcludeIdSeen { get; private set; }
        public bool DeleteResult { get; init; }
        public bool NameExists { get; init; }
        public bool SlugExists { get; init; }
        public TagDto? GetByIdResult { get; init; }
        public bool? CapturedGetByIdPublishedOnly { get; private set; }

        public Task<IReadOnlyList<TagDto>> GetAllAsync(
            bool publishedOnly,
            CancellationToken cancellationToken) =>
            throw new NotSupportedException();

        public Task<TagDto?> GetByIdAsync(
            int id,
            bool publishedOnly,
            CancellationToken cancellationToken)
        {
            CapturedGetByIdPublishedOnly = publishedOnly;
            return Task.FromResult(GetByIdResult);
        }

        public Task<bool> NameExistsAsync(
            string name,
            int? excludeId,
            CancellationToken cancellationToken)
        {
            ExcludeIdSeen = excludeId;
            return Task.FromResult(NameExists);
        }

        public Task<bool> SlugExistsAsync(
            string slug,
            int? excludeId,
            CancellationToken cancellationToken)
        {
            ExcludeIdSeen = excludeId;
            return Task.FromResult(SlugExists);
        }

        public Task<TagDto> CreateAsync(
            string name,
            string slug,
            CancellationToken cancellationToken)
        {
            CreateCalled = true;
            return Task.FromResult(Tag());
        }

        public Task<TagDto?> UpdateAsync(
            int id,
            string name,
            string slug,
            CancellationToken cancellationToken) =>
            Task.FromResult<TagDto?>(null);

        public Task<bool> DeleteAsync(
            int id,
            CancellationToken cancellationToken)
        {
            DeleteCalled = true;
            return Task.FromResult(DeleteResult);
        }

        public Task<IReadOnlyList<int>> GetExistingIdsAsync(
            IReadOnlyList<int> ids,
            CancellationToken cancellationToken) =>
            throw new NotSupportedException();
    }
}
