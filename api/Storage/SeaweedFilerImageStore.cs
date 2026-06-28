using BlogSite.Api.Options;
using BlogSite.Api.Results;
using Microsoft.Extensions.Options;

namespace BlogSite.Api.Storage;

public sealed class SeaweedFilerImageStore(
    HttpClient httpClient,
    IOptions<SeaweedFilerOptions> options,
    ILogger<SeaweedFilerImageStore> logger) : IImageStore
{
    public Task<Result<StoredImage>> UploadAsync(
        ImageStoreUpload upload,
        CancellationToken cancellationToken) =>
        throw new NotImplementedException();
}
