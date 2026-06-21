using BlogSite.Api.DTOs;
using BlogSite.Api.Repositories;
using BlogSite.Api.Services;

namespace BlogSite.Api.Tests.Services;

public class TagServiceTests
{
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
    public async Task DeleteAsync_ExistingTag_ReturnsSuccess()
    {
        var repository = new FakeTagRepository
        {
            DeleteResult = true
        };
        var service = new TagService(repository);

        var result = await service.DeleteAsync(
            1,
            CancellationToken.None);

        Assert.True(result.IsSuccess);
    }

    private sealed class FakeTagRepository : ITagRepository
    {
        public bool CreateCalled { get; private set; }
        public bool DeleteResult { get; init; }

        public Task<IReadOnlyList<TagDto>> GetAllAsync(
            CancellationToken cancellationToken) =>
            throw new NotSupportedException();

        public Task<TagDto?> GetByIdAsync(
            int id,
            CancellationToken cancellationToken) =>
            throw new NotSupportedException();

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
            CancellationToken cancellationToken) =>
            Task.FromResult(DeleteResult);

        private static TagDto Tag() =>
            new(1, "Tag", "tag", 0, DateTime.UtcNow);
    }
}
