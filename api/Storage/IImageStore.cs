using BlogSite.Api.Results;

namespace BlogSite.Api.Storage;

public sealed record ImageStoreUpload(
    Stream Content,
    string ObjectPath,
    string ContentType);

public sealed record StoredImage(string Url);

public interface IImageStore
{
    Task<Result<StoredImage>> UploadAsync(
        ImageStoreUpload upload,
        CancellationToken cancellationToken);
}
