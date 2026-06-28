using BlogSite.Api.DTOs;
using BlogSite.Api.Options;
using BlogSite.Api.Results;
using BlogSite.Api.Storage;
using Microsoft.Extensions.Options;

namespace BlogSite.Api.Services;

public sealed class MediaService
{
    public const long MaximumFileSizeBytes = 10 * 1024 * 1024;
    public const long MaximumRequestSizeBytes =
        MaximumFileSizeBytes + (1024 * 1024);

    private static readonly IReadOnlyDictionary<string, string> AllowedTypes =
        new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
        {
            ["image/jpeg"] = ".jpg",
            ["image/png"] = ".png",
            ["image/webp"] = ".webp",
            ["image/gif"] = ".gif"
        };

    private readonly IImageStore imageStore;
    private readonly Func<DateTimeOffset> utcNow;
    private readonly Func<Guid> newId;
    private readonly string pathPrefix;

    public MediaService(
        IImageStore imageStore,
        IOptions<SeaweedFilerOptions> options)
        : this(
            imageStore,
            () => DateTimeOffset.UtcNow,
            Guid.NewGuid,
            options.Value.PathPrefix)
    {
    }

    internal MediaService(
        IImageStore imageStore,
        Func<DateTimeOffset> utcNow,
        Func<Guid> newId,
        string pathPrefix)
    {
        this.imageStore = imageStore;
        this.utcNow = utcNow;
        this.newId = newId;
        this.pathPrefix = pathPrefix;
    }

    public async Task<Result<MediaUploadDto>> UploadImageAsync(
        Stream content,
        long length,
        string? contentType,
        CancellationToken cancellationToken)
    {
        if (length <= 0)
        {
            return Result<MediaUploadDto>.Failure(
                "media.file_required",
                "An image file is required.");
        }

        if (length > MaximumFileSizeBytes)
        {
            return Result<MediaUploadDto>.Failure(
                "media.file_too_large",
                "The image exceeds the 10 MiB limit.");
        }

        if (contentType is null || !AllowedTypes.TryGetValue(contentType, out var extension))
        {
            return Result<MediaUploadDto>.Failure(
                "media.unsupported_type",
                "The image type is not supported.");
        }

        var now = utcNow();
        var objectPath =
            $"{pathPrefix}/{now:yyyy}/{now:MM}/{newId():D}{extension}";
        var stored = await imageStore.UploadAsync(
            new ImageStoreUpload(content, objectPath, contentType),
            cancellationToken);

        return stored.IsFailure
            ? Result<MediaUploadDto>.Failure(
                stored.Error!.Code,
                stored.Error.Message)
            : Result<MediaUploadDto>.Success(
                new MediaUploadDto(stored.Value!.Url));
    }
}
