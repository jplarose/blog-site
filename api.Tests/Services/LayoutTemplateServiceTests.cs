using BlogSite.Api.DTOs;
using BlogSite.Api.Repositories;
using BlogSite.Api.Services;
using System.Text.Json;

namespace BlogSite.Api.Tests.Services;

public class LayoutTemplateServiceTests
{
    [Fact]
    public async Task CreateAsync_BlankName_ReturnsValidationFailure()
    {
        var repository = new FakeLayoutTemplateRepository();
        var service = new LayoutTemplateService(repository);

        var result = await service.CreateAsync(
            new CreateLayoutTemplateRequest(" ", "", EmptyLayout(), false),
            CancellationToken.None);

        Assert.True(result.IsFailure);
        Assert.Equal("template.name_required", result.Error?.Code);
        Assert.False(repository.CreateCalled);
    }

    [Fact]
    public async Task CreateAsync_DefaultTemplate_ForwardsDefaultFlag()
    {
        var repository = new FakeLayoutTemplateRepository();
        var service = new LayoutTemplateService(repository);

        var result = await service.CreateAsync(
            new CreateLayoutTemplateRequest(" Main ", "", EmptyLayout(), true),
            CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.True(repository.CreatedAsDefault);
        Assert.Equal("Main", repository.CreatedName);
    }

    [Fact]
    public async Task DeleteAsync_MissingTemplate_ReturnsNotFound()
    {
        var repository = new FakeLayoutTemplateRepository
        {
            DeleteResult = false
        };
        var service = new LayoutTemplateService(repository);

        var result = await service.DeleteAsync(
            42,
            CancellationToken.None);

        Assert.True(result.IsFailure);
        Assert.Equal("template.not_found", result.Error?.Code);
    }

    private static JsonElement EmptyLayout() =>
        JsonSerializer.SerializeToElement(new { version = 1 });

    private sealed class FakeLayoutTemplateRepository : ILayoutTemplateRepository
    {
        public bool CreateCalled { get; private set; }
        public string? CreatedName { get; private set; }
        public bool CreatedAsDefault { get; private set; }
        public bool DeleteResult { get; init; }

        public Task<IReadOnlyList<LayoutTemplateSummaryDto>> GetAllAsync(
            CancellationToken cancellationToken) =>
            throw new NotSupportedException();

        public Task<LayoutTemplateDto?> GetByIdAsync(
            int id,
            CancellationToken cancellationToken) =>
            throw new NotSupportedException();

        public Task<LayoutTemplateDto> CreateAsync(
            string name,
            string description,
            JsonElement layout,
            bool isDefault,
            CancellationToken cancellationToken)
        {
            CreateCalled = true;
            CreatedName = name;
            CreatedAsDefault = isDefault;
            return Task.FromResult(Template(name, layout, isDefault));
        }

        public Task<LayoutTemplateDto?> UpdateAsync(
            int id,
            string name,
            string description,
            JsonElement layout,
            bool isDefault,
            CancellationToken cancellationToken) =>
            Task.FromResult<LayoutTemplateDto?>(null);

        public Task<bool> DeleteAsync(
            int id,
            CancellationToken cancellationToken) =>
            Task.FromResult(DeleteResult);

        private static LayoutTemplateDto Template(
            string name,
            JsonElement layout,
            bool isDefault) =>
            new(
                1,
                name,
                "",
                layout,
                isDefault,
                DateTime.UtcNow,
                DateTime.UtcNow);
    }
}
