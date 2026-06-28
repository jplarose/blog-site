using BlogSite.Api.Services;
using BlogSite.Api.Storage;

namespace BlogSite.Api.Tests.Services;

public class MediaServiceTests
{
    [Theory]
    [InlineData("image/jpeg", ".jpg")]
    [InlineData("image/png", ".png")]
    [InlineData("image/webp", ".webp")]
    [InlineData("image/gif", ".gif")]
    public async Task UploadImageAsync_AllowedType_GeneratesExpectedPath(
        string contentType,
        string extension)
    {
        var store = new FakeImageStore();
        var clock = new DateTimeOffset(2026, 6, 21, 12, 0, 0, TimeSpan.Zero);
        var service = new MediaService(
            store,
            () => clock,
            () => Guid.Parse("7bf42d61-6abc-49ec-a01d-bf1ae57fcfea"),
            "images");
        await using var content = new MemoryStream([1, 2, 3]);

        var result = await service.UploadImageAsync(
            content,
            content.Length,
            contentType,
            CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.Equal(
            $"images/2026/06/7bf42d61-6abc-49ec-a01d-bf1ae57fcfea{extension}",
            store.Upload?.ObjectPath);
    }

    [Fact]
    public async Task UploadImageAsync_EmptyFile_ReturnsRequiredFailure()
    {
        var store = new FakeImageStore();
        var service = CreateService(store);

        var result = await service.UploadImageAsync(
            Stream.Null,
            0,
            "image/png",
            CancellationToken.None);

        Assert.Equal("media.file_required", result.Error?.Code);
        Assert.Null(store.Upload);
    }

    [Fact]
    public async Task UploadImageAsync_UnsupportedType_ReturnsUnsupportedFailure()
    {
        var store = new FakeImageStore();
        var service = CreateService(store);

        var result = await service.UploadImageAsync(
            Stream.Null,
            1,
            "image/svg+xml",
            CancellationToken.None);

        Assert.Equal("media.unsupported_type", result.Error?.Code);
        Assert.Null(store.Upload);
    }

    [Fact]
    public async Task UploadImageAsync_FileOverTenMiB_ReturnsTooLargeFailure()
    {
        var store = new FakeImageStore();
        var service = CreateService(store);

        var result = await service.UploadImageAsync(
            Stream.Null,
            MediaService.MaximumFileSizeBytes + 1,
            "image/png",
            CancellationToken.None);

        Assert.Equal("media.file_too_large", result.Error?.Code);
        Assert.Null(store.Upload);
    }

    [Fact]
    public async Task UploadImageAsync_StoreFailure_PreservesStableError()
    {
        var store = new FakeImageStore
        {
            Result = BlogSite.Api.Results.Result<StoredImage>.Failure(
                "media.storage_failed",
                "The image could not be stored.")
        };
        var service = CreateService(store);

        var result = await service.UploadImageAsync(
            Stream.Null,
            1,
            "image/png",
            CancellationToken.None);

        Assert.Equal("media.storage_failed", result.Error?.Code);
    }

    private static MediaService CreateService(IImageStore store) =>
        new(
            store,
            () => new DateTimeOffset(2026, 6, 21, 0, 0, 0, TimeSpan.Zero),
            () => Guid.Parse("7bf42d61-6abc-49ec-a01d-bf1ae57fcfea"),
            "images");

    private sealed class FakeImageStore : IImageStore
    {
        public ImageStoreUpload? Upload { get; private set; }
        public BlogSite.Api.Results.Result<StoredImage> Result { get; init; } =
            BlogSite.Api.Results.Result<StoredImage>.Success(
                new StoredImage("https://media.example.test/image.png"));

        public Task<BlogSite.Api.Results.Result<StoredImage>> UploadAsync(
            ImageStoreUpload upload,
            CancellationToken cancellationToken)
        {
            Upload = upload;
            return Task.FromResult(Result);
        }
    }
}
