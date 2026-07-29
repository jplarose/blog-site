using System.Text.Json;
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
            new CreateCategoryRequest(" ", "slug", null),
            CancellationToken.None);

        Assert.True(result.IsFailure);
        Assert.Equal("category.name_required", result.Error?.Code);
        Assert.False(repository.CreateCalled);
    }

    [Fact]
    public async Task CreateAsync_BlankSlug_ReturnsValidationFailure()
    {
        var repository = new FakeCategoryRepository();
        var service = new CategoryService(repository);

        var result = await service.CreateAsync(
            new CreateCategoryRequest("News", " ", null),
            CancellationToken.None);

        Assert.True(result.IsFailure);
        Assert.Equal("category.slug_required", result.Error?.Code);
        Assert.False(repository.CreateCalled);
    }

    [Theory]
    [InlineData("Not Safe")]
    [InlineData("UPPERCASE")]
    [InlineData("trailing-")]
    [InlineData("-leading")]
    [InlineData("has_underscore")]
    public async Task CreateAsync_SlugNotUrlSafe_ReturnsValidationFailure(string slug)
    {
        var repository = new FakeCategoryRepository();
        var service = new CategoryService(repository);

        var result = await service.CreateAsync(
            new CreateCategoryRequest("News", slug, null),
            CancellationToken.None);

        Assert.True(result.IsFailure);
        Assert.Equal("category.slug_invalid", result.Error?.Code);
        Assert.False(repository.CreateCalled);
    }

    [Fact]
    public async Task CreateAsync_DuplicateName_ReturnsConflict()
    {
        var repository = new FakeCategoryRepository { NameExists = true };
        var service = new CategoryService(repository);

        var result = await service.CreateAsync(
            new CreateCategoryRequest("News", "news", null),
            CancellationToken.None);

        Assert.True(result.IsFailure);
        Assert.Equal("category.duplicate_name", result.Error?.Code);
        Assert.False(repository.CreateCalled);
    }

    [Fact]
    public async Task CreateAsync_DuplicateSlug_ReturnsConflict()
    {
        var repository = new FakeCategoryRepository { SlugExists = true };
        var service = new CategoryService(repository);

        var result = await service.CreateAsync(
            new CreateCategoryRequest("News", "news", null),
            CancellationToken.None);

        Assert.True(result.IsFailure);
        Assert.Equal("category.duplicate_slug", result.Error?.Code);
        Assert.False(repository.CreateCalled);
    }

    [Fact]
    public async Task CreateAsync_ValidRequest_TrimsNameAndSlug()
    {
        var repository = new FakeCategoryRepository();
        var service = new CategoryService(repository);

        var result = await service.CreateAsync(
            new CreateCategoryRequest(" News ", " news ", "Latest"),
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
            new UpdateCategoryRequest("News", "news", null),
            CancellationToken.None);

        Assert.True(result.IsFailure);
        Assert.Equal("category.not_found", result.Error?.Code);
    }

    [Fact]
    public async Task UpdateAsync_DuplicateSlugOnAnotherCategory_ReturnsConflict()
    {
        var repository = new FakeCategoryRepository { SlugExists = true };
        var service = new CategoryService(repository);

        var result = await service.UpdateAsync(
            42,
            new UpdateCategoryRequest("News", "news", null),
            CancellationToken.None);

        Assert.True(result.IsFailure);
        Assert.Equal("category.duplicate_slug", result.Error?.Code);
        Assert.Equal(42, repository.ExcludeIdSeen);
    }

    [Fact]
    public async Task DeleteAsync_MissingCategory_ReturnsNotFound()
    {
        var repository = new FakeCategoryRepository { GetByIdResult = null };
        var service = new CategoryService(repository);

        var result = await service.DeleteAsync(42, CancellationToken.None);

        Assert.True(result.IsFailure);
        Assert.Equal("category.not_found", result.Error?.Code);
    }

    [Fact]
    public async Task DeleteAsync_ReferencedByPosts_ReturnsConflictWithoutDeleting()
    {
        var repository = new FakeCategoryRepository
        {
            GetByIdResult = Category() with { PostCount = 3 }
        };
        var service = new CategoryService(repository);

        var result = await service.DeleteAsync(1, CancellationToken.None);

        Assert.True(result.IsFailure);
        Assert.Equal("category.referenced", result.Error?.Code);
        Assert.False(repository.DeleteCalled);
    }

    [Fact]
    public async Task DeleteAsync_NotReferenced_Succeeds()
    {
        var repository = new FakeCategoryRepository
        {
            GetByIdResult = Category() with { PostCount = 0 },
            DeleteResult = true
        };
        var service = new CategoryService(repository);

        var result = await service.DeleteAsync(1, CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.True(repository.DeleteCalled);
    }

    [Fact]
    public void CategoryDto_Serialized_HasNoDefaultTemplateIdProperty()
    {
        var json = JsonSerializer.Serialize(Category());
        using var document = JsonDocument.Parse(json);

        Assert.False(document.RootElement.TryGetProperty("defaultTemplateId", out _));
        Assert.False(document.RootElement.TryGetProperty("defaultTemplateName", out _));
    }

    private static CategoryDto Category() =>
        new(
            1,
            "News",
            "news",
            null,
            0,
            DateTime.UtcNow,
            DateTime.UtcNow);

    private sealed class FakeCategoryRepository : ICategoryRepository
    {
        public bool CreateCalled { get; private set; }
        public bool DeleteCalled { get; private set; }
        public string? CreatedName { get; private set; }
        public string? CreatedSlug { get; private set; }
        public int? ExcludeIdSeen { get; private set; }
        public CategoryDto? UpdateResult { get; init; }
        public CategoryDto? GetByIdResult { get; init; }
        public bool DeleteResult { get; init; }
        public bool NameExists { get; init; }
        public bool SlugExists { get; init; }
        public bool? CapturedGetByIdPublishedOnly { get; private set; }

        public Task<IReadOnlyList<CategoryDto>> GetAllAsync(
            bool publishedOnly,
            CancellationToken cancellationToken) =>
            throw new NotSupportedException();

        public Task<CategoryDto?> GetByIdAsync(
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

        public Task<CategoryDto> CreateAsync(
            string name,
            string slug,
            string? description,
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
            CancellationToken cancellationToken) =>
            Task.FromResult(UpdateResult);

        public Task<bool> DeleteAsync(
            int id,
            CancellationToken cancellationToken)
        {
            DeleteCalled = true;
            return Task.FromResult(DeleteResult);
        }
    }
}
