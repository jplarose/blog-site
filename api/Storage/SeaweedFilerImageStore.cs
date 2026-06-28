using System.Net;
using BlogSite.Api.Options;
using BlogSite.Api.Results;
using Microsoft.Extensions.Options;

namespace BlogSite.Api.Storage;

public sealed class SeaweedFilerImageStore(
    HttpClient httpClient,
    IOptions<SeaweedFilerOptions> options,
    ILogger<SeaweedFilerImageStore> logger) : IImageStore
{
    private const int MaximumAttempts = 3;

    public async Task<Result<StoredImage>> UploadAsync(
        ImageStoreUpload upload,
        CancellationToken cancellationToken)
    {
        byte[] bytes;
        using (var buffer = new MemoryStream())
        {
            await upload.Content.CopyToAsync(buffer, cancellationToken);
            bytes = buffer.ToArray();
        }

        var privateUrl = BuildUrl(options.Value.PrivateBaseUrl, upload.ObjectPath);

        for (var attempt = 1; attempt <= MaximumAttempts; attempt++)
        {
            using var multipart = new MultipartFormDataContent();
            using var fileContent = new ByteArrayContent(bytes);
            fileContent.Headers.ContentType =
                new System.Net.Http.Headers.MediaTypeHeaderValue(upload.ContentType);
            multipart.Add(
                fileContent,
                "file",
                Path.GetFileName(upload.ObjectPath));

            try
            {
                using var response = await httpClient.PostAsync(
                    privateUrl,
                    multipart,
                    cancellationToken);

                if (response.IsSuccessStatusCode)
                {
                    return Result<StoredImage>.Success(
                        new StoredImage(
                            BuildUrl(options.Value.PublicBaseUrl, upload.ObjectPath)));
                }

                if (!IsTransient(response.StatusCode) || attempt == MaximumAttempts)
                {
                    logger.LogWarning(
                        "SeaweedFS upload failed for {ObjectPath} with status {StatusCode}.",
                        upload.ObjectPath,
                        response.StatusCode);

                    return StorageFailure();
                }
            }
            catch (HttpRequestException exception) when (attempt < MaximumAttempts)
            {
                logger.LogWarning(
                    exception,
                    "Transient SeaweedFS upload failure for {ObjectPath} on attempt {Attempt}.",
                    upload.ObjectPath,
                    attempt);
            }
            catch (HttpRequestException exception)
            {
                logger.LogError(
                    exception,
                    "SeaweedFS upload failed for {ObjectPath}.",
                    upload.ObjectPath);
                return StorageFailure();
            }
        }

        return StorageFailure();
    }

    private static bool IsTransient(HttpStatusCode statusCode) =>
        statusCode is HttpStatusCode.RequestTimeout
            or HttpStatusCode.TooManyRequests
        || (int)statusCode >= 500;

    private static string BuildUrl(string baseUrl, string objectPath) =>
        $"{baseUrl.TrimEnd('/')}/{objectPath.TrimStart('/')}";

    private static Result<StoredImage> StorageFailure() =>
        Result<StoredImage>.Failure(
            "media.storage_failed",
            "The image could not be stored.");
}
