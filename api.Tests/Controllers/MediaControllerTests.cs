using BlogSite.Api.Controllers;
using BlogSite.Api.Options;
using BlogSite.Api.Services;
using BlogSite.Api.Storage;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;

namespace BlogSite.Api.Tests.Controllers;

public class MediaControllerTests
{
    [Fact]
    public async Task UploadImage_MissingFile_ReturnsBadRequest()
    {
        var controller = CreateController();

        var result = await controller.UploadImage(null, CancellationToken.None);

        var response = Assert.IsType<ObjectResult>(result.Result);
        Assert.Equal(StatusCodes.Status400BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task UploadImage_UnsupportedType_ReturnsUnsupportedMediaType()
    {
        var controller = CreateController();
        var file = FormFile("image/svg+xml", 3);

        var result = await controller.UploadImage(file, CancellationToken.None);

        var response = Assert.IsType<ObjectResult>(result.Result);
        Assert.Equal(StatusCodes.Status415UnsupportedMediaType, response.StatusCode);
    }

    [Fact]
    public async Task UploadImage_TooLarge_ReturnsPayloadTooLarge()
    {
        var controller = CreateController();
        var file = FormFile(
            "image/png",
            MediaService.MaximumFileSizeBytes + 1);

        var result = await controller.UploadImage(file, CancellationToken.None);

        var response = Assert.IsType<ObjectResult>(result.Result);
        Assert.Equal(StatusCodes.Status413PayloadTooLarge, response.StatusCode);
    }

    [Fact]
    public async Task UploadImage_StoreFailure_ReturnsBadGateway()
    {
        var controller = CreateController(storageFailure: true);
        var file = FormFile("image/png", 3);

        var result = await controller.UploadImage(file, CancellationToken.None);

        var response = Assert.IsType<ObjectResult>(result.Result);
        Assert.Equal(StatusCodes.Status502BadGateway, response.StatusCode);
    }

    [Fact]
    public async Task UploadImage_Success_ReturnsCreatedResponse()
    {
        var controller = CreateController();
        var file = FormFile("image/png", 3);

        var result = await controller.UploadImage(file, CancellationToken.None);

        var response = Assert.IsType<ObjectResult>(result.Result);
        Assert.Equal(StatusCodes.Status201Created, response.StatusCode);
    }

    private static MediaController CreateController(bool storageFailure = false)
    {
        var store = new FakeImageStore(storageFailure);
        var service = new MediaService(
            store,
            Microsoft.Extensions.Options.Options.Create(
                new SeaweedFilerOptions { PathPrefix = "images" }));
        return new MediaController(service);
    }

    private static IFormFile FormFile(string contentType, long length)
    {
        var bytes = new byte[(int)Math.Min(length, 3)];
        return new FormFile(
            new MemoryStream(bytes),
            0,
            length,
            "file",
            "image")
        {
            Headers = new HeaderDictionary(),
            ContentType = contentType
        };
    }

    private sealed class FakeImageStore(bool storageFailure) : IImageStore
    {
        public Task<BlogSite.Api.Results.Result<StoredImage>> UploadAsync(
            ImageStoreUpload upload,
            CancellationToken cancellationToken) =>
            Task.FromResult(
                storageFailure
                    ? BlogSite.Api.Results.Result<StoredImage>.Failure(
                        "media.storage_failed",
                        "The image could not be stored.")
                    : BlogSite.Api.Results.Result<StoredImage>.Success(
                        new StoredImage("https://media.example.test/image.png")));
    }
}
