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
        var service = new PostService(repository);

        var result = await service.CreateAsync(
            CreateRequest(status: "unknown"),
            CancellationToken.None);

        Assert.True(result.IsFailure);
        Assert.Equal("post.invalid_status", result.Error?.Code);
        Assert.Null(repository.CreatedPost);
    }

    [Fact]
    public async Task CreateAsync_NormalizesTagsBeforeWriting()
    {
        var repository = new FakePostRepository
        {
            CreateResult = PostDto()
        };
        var service = new PostService(repository);

        var result = await service.CreateAsync(
            CreateRequest(tags: ["  C#  ", "c#", "ASP.NET Core"]),
            CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.Collection(
            repository.CreatedPost!.Tags,
            tag =>
            {
                Assert.Equal("C#", tag.Name);
                Assert.Equal("c", tag.Slug);
            },
            tag =>
            {
                Assert.Equal("ASP.NET Core", tag.Name);
                Assert.Equal("asp-net-core", tag.Slug);
            });
    }

    [Fact]
    public async Task CreateAsync_TagsWithSameSlug_WriteOneAssociation()
    {
        var repository = new FakePostRepository
        {
            CreateResult = PostDto()
        };
        var service = new PostService(repository);

        await service.CreateAsync(
            CreateRequest(tags: ["C#", "C++"]),
            CancellationToken.None);

        var tag = Assert.Single(repository.CreatedPost!.Tags);
        Assert.Equal("c", tag.Slug);
    }

    [Fact]
    public async Task UpdateAsync_MissingPost_ReturnsNotFound()
    {
        var repository = new FakePostRepository();
        var service = new PostService(repository);

        var result = await service.UpdateAsync(
            42,
            UpdateRequest(),
            CancellationToken.None);

        Assert.True(result.IsFailure);
        Assert.Equal("post.not_found", result.Error?.Code);
    }

    [Fact]
    public async Task PublishAsync_ExistingPost_ReturnsRepositoryValue()
    {
        var expected = PostDto();
        var repository = new FakePostRepository
        {
            PublishResult = expected
        };
        var service = new PostService(repository);

        var result = await service.PublishAsync(
            expected.Id,
            CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.Same(expected, result.Value);
    }

    private static CreatePostRequest CreateRequest(
        string status = "Draft",
        IEnumerable<string>? tags = null) =>
        new(
            "Title",
            "title",
            "Content",
            null,
            null,
            status,
            null,
            null,
            null,
            null,
            tags ?? []);

    private static UpdatePostRequest UpdateRequest() =>
        new(
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
            []);

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
            null,
            null,
            null,
            [],
            DateTime.UtcNow,
            DateTime.UtcNow);

    private sealed class FakePostRepository : IPostRepository
    {
        public PostWrite? CreatedPost { get; private set; }
        public PostDto CreateResult { get; init; } = PostDto();
        public PostDto? UpdateResult { get; init; }
        public PostDto? PublishResult { get; init; }

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
    }
}
