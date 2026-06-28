namespace BlogSite.Api.Options;

/// <summary>
/// SeaweedFS Filer settings for image storage.
/// </summary>
public sealed class SeaweedFilerOptions
{
    public const string SectionName = "SeaweedFiler";

    /// <summary>
    /// Internal Filer endpoint used by the API for uploads.
    /// </summary>
    public string PrivateBaseUrl { get; init; } = "";

    /// <summary>
    /// Browser-accessible media origin used in returned image URLs.
    /// </summary>
    public string PublicBaseUrl { get; init; } = "";

    /// <summary>
    /// Object namespace for uploaded images.
    /// </summary>
    public string PathPrefix { get; init; } = "images";
}
