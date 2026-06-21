using BlogSite.Api.DTOs;
using BlogSite.Api.Repositories;
using BlogSite.Api.Services;

namespace BlogSite.Api.Tests.Services;

public class CategoryServiceTests
{
    [Fact]
    public async Task CreateAsync_BlankName_ReturnsValidationFailure()
    {
        var repository = new FakeCategoryRepository();
        var service = new CategoryService(repository);

        var result = await service.CreateAsync(
            new CreateCategoryRequest(" ", "slug", null, null),
            CancellationToken.None);

        Assert.True(result.IsFailure);
        Assert.Equal("category.name_required", result.Error?.Code);
        Assert.False(repository.CreateCalled);
    }

    [Fact]
    public async Task CreateAsync_ValidRequest_TrimsNameAndSlug()
    {
        var repository = new FakeCategoryRepository();
        var service = new CategoryService(repository);

        var result = await service.CreateAsync(
            new CreateCategoryRequest(" News ", " news ", "Latest", null),
            CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.Equal("News", repository.CreatedName);
        Assert.Equal("news", repository.CreatedSlug);
    }

    [Fact]
    public async Task UpdateAsync_MissingCategory_ReturnsNotFound()
    {
        var repository = new FakeCategoryRepository
        {
            UpdateResult = null
        };
        var service = new CategoryService(repository);

        var result = await service.UpdateAsync(
            42,
            new UpdateCategoryRequest("News", "news", null, null),
            CancellationToken.None);

        Assert.True(result.IsFailure);
        Assert.Equal("category.not_found", result.Error?.Code);
    }

    private sealed class FakeCategoryRepository : ICategoryRepository
    {
        public bool CreateCalled { get; private set; }
        public string? CreatedName { get; private set; }
        public string? CreatedSlug { get; private set; }
        public CategoryDto? UpdateResult { get; init; }

        public Task<IReadOnlyList<CategoryDto>> GetAllAsync(
            CancellationToken cancellationToken) =>
            throw new NotSupportedException();

        public Task<CategoryDto?> GetByIdAsync(
            int id,
            CancellationToken cancellationToken) =>
            throw new NotSupportedException();

        public Task<CategoryDto> CreateAsync(
            string name,
            string slug,
            string? description,
            int? defaultTemplateId,
            CancellationToken cancellationToken)
        {
            CreateCalled = true;
            CreatedName = name;
            CreatedSlug = slug;
            return Task.FromResult(Category());
        }

        public Task<CategoryDto?> UpdateAsync(
            int id,
            string name,
            string slug,
            string? description,
            int? defaultTemplateId,
            CancellationToken cancellationToken) =>
            Task.FromResult(UpdateResult);

        public Task<bool> DeleteAsync(
            int id,
            CancellationToken cancellationToken) =>
            Task.FromResult(false);

        private static CategoryDto Category() =>
            new(
                1,
                "News",
                "news",
                null,
                null,
                null,
                0,
                DateTime.UtcNow,
                DateTime.UtcNow);
    }
}
