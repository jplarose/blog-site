using System.Text.RegularExpressions;
using BlogSite.Api.Options;
using BlogSite.Api.Storage;

namespace BlogSite.Api.Extensions;

/// <summary>
/// Registers image storage services.
/// </summary>
public static partial class AddImageStorageExtension
{
    /// <summary>
    /// Adds configured image storage backed by SeaweedFS Filer.
    /// </summary>
    public static IServiceCollection AddImageStorage(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        services
            .AddOptions<SeaweedFilerOptions>()
            .Bind(configuration.GetSection(SeaweedFilerOptions.SectionName))
            .Validate(
                options => IsAbsoluteHttpUrl(options.PrivateBaseUrl),
                "SeaweedFiler:PrivateBaseUrl must be an absolute HTTP or HTTPS URL.")
            .Validate(
                options => IsAbsoluteHttpUrl(options.PublicBaseUrl),
                "SeaweedFiler:PublicBaseUrl must be an absolute HTTP or HTTPS URL.")
            .Validate(
                options => PathPrefixPattern().IsMatch(options.PathPrefix),
                "SeaweedFiler:PathPrefix may contain letters, numbers, hyphens, underscores, and single slashes.")
            .ValidateOnStart();

        services.AddHttpClient<IImageStore, SeaweedFilerImageStore>();
        return services;
    }

    private static bool IsAbsoluteHttpUrl(string value) =>
        Uri.TryCreate(value, UriKind.Absolute, out var uri)
        && (uri.Scheme == Uri.UriSchemeHttp || uri.Scheme == Uri.UriSchemeHttps);

    [GeneratedRegex(@"^[A-Za-z0-9_-]+(?:/[A-Za-z0-9_-]+)*$")]
    private static partial Regex PathPrefixPattern();
}
