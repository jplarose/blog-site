using System.Net;
using BlogSite.Api.Options;
using BlogSite.Api.Storage;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;

namespace BlogSite.Api.Tests.Storage;

public class SeaweedFilerImageStoreTests
{
    [Fact]
    public async Task UploadAsync_Success_SendsMultipartAndReturnsPublicUrl()
    {
        var handler = new RecordingHandler(HttpStatusCode.Created);
        var store = CreateStore(handler);
        await using var content = new MemoryStream([1, 2, 3]);

        var result = await store.UploadAsync(
            new ImageStoreUpload(
                content,
                "images/2026/06/image-id.webp",
                "image/webp"),
            CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.Equal(
            "https://media.example.test/images/2026/06/image-id.webp",
            result.Value?.Url);
        Assert.Equal(
            "http://seaweed-filer:8888/images/2026/06/image-id.webp",
            handler.RequestUri?.ToString());
        Assert.Equal("multipart/form-data", handler.ContentType?.MediaType);
        Assert.Contains("image/webp", handler.RequestBody);
    }

    [Fact]
    public async Task UploadAsync_TransientFailure_RetriesThenSucceeds()
    {
        var handler = new SequenceHandler(
            HttpStatusCode.ServiceUnavailable,
            HttpStatusCode.Created);
        var store = CreateStore(handler);
        await using var content = new MemoryStream([1, 2, 3]);

        var result = await store.UploadAsync(
            new ImageStoreUpload(content, "images/2026/06/id.jpg", "image/jpeg"),
            CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.Equal(2, handler.CallCount);
    }

    [Fact]
    public async Task UploadAsync_PermanentFailure_ReturnsStorageFailure()
    {
        var handler = new RecordingHandler(HttpStatusCode.BadRequest);
        var store = CreateStore(handler);
        await using var content = new MemoryStream([1, 2, 3]);

        var result = await store.UploadAsync(
            new ImageStoreUpload(content, "images/2026/06/id.jpg", "image/jpeg"),
            CancellationToken.None);

        Assert.True(result.IsFailure);
        Assert.Equal("media.storage_failed", result.Error?.Code);
        Assert.Equal(1, handler.CallCount);
    }

    [Fact]
    public async Task UploadAsync_Cancellation_Propagates()
    {
        var handler = new CancellationHandler();
        var store = CreateStore(handler);
        await using var content = new MemoryStream([1, 2, 3]);
        using var cancellation = new CancellationTokenSource();
        cancellation.Cancel();

        await Assert.ThrowsAnyAsync<OperationCanceledException>(
            () => store.UploadAsync(
                new ImageStoreUpload(content, "images/2026/06/id.jpg", "image/jpeg"),
                cancellation.Token));
    }

    private static SeaweedFilerImageStore CreateStore(HttpMessageHandler handler) =>
        new(
            new HttpClient(handler),
            Microsoft.Extensions.Options.Options.Create(new SeaweedFilerOptions
            {
                PrivateBaseUrl = "http://seaweed-filer:8888/",
                PublicBaseUrl = "https://media.example.test/",
                PathPrefix = "images"
            }),
            NullLogger<SeaweedFilerImageStore>.Instance);

    private sealed class RecordingHandler(HttpStatusCode statusCode) : HttpMessageHandler
    {
        public int CallCount { get; private set; }
        public Uri? RequestUri { get; private set; }
        public System.Net.Http.Headers.MediaTypeHeaderValue? ContentType { get; private set; }
        public string RequestBody { get; private set; } = "";

        protected override async Task<HttpResponseMessage> SendAsync(
            HttpRequestMessage request,
            CancellationToken cancellationToken)
        {
            CallCount++;
            RequestUri = request.RequestUri;
            ContentType = request.Content?.Headers.ContentType;
            RequestBody = request.Content is null
                ? ""
                : await request.Content.ReadAsStringAsync(cancellationToken);
            return new HttpResponseMessage(statusCode);
        }
    }

    private sealed class SequenceHandler(params HttpStatusCode[] statuses) : HttpMessageHandler
    {
        public int CallCount { get; private set; }

        protected override Task<HttpResponseMessage> SendAsync(
            HttpRequestMessage request,
            CancellationToken cancellationToken)
        {
            var status = statuses[Math.Min(CallCount, statuses.Length - 1)];
            CallCount++;
            return Task.FromResult(new HttpResponseMessage(status));
        }
    }

    private sealed class CancellationHandler : HttpMessageHandler
    {
        protected override Task<HttpResponseMessage> SendAsync(
            HttpRequestMessage request,
            CancellationToken cancellationToken) =>
            Task.FromCanceled<HttpResponseMessage>(cancellationToken);
    }
}
