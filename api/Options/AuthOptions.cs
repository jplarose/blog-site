namespace BlogSite.Api.Options;

/// <summary>
/// Settings for validating JWTs issued by the shared Auth API and for
/// calling back into it to check token revocation.
/// </summary>
public sealed class AuthOptions
{
    public const string SectionName = "Auth";

    /// <summary>
    /// JWT signing/validation settings.
    /// </summary>
    public AuthJwtOptions Jwt { get; init; } = new();

    /// <summary>
    /// Base URL of the Auth API, used for the jti revocation check.
    /// </summary>
    public string BaseUrl { get; init; } = "";

    /// <summary>
    /// Opaque API key sent as <c>X-Api-Key</c> on revocation checks.
    /// </summary>
    public string ApiKey { get; init; } = "";
}

/// <summary>
/// JWT signing and validation settings shared with the Auth API.
/// </summary>
public sealed class AuthJwtOptions
{
    /// <summary>
    /// HS256 shared signing secret. Must be at least 32 bytes.
    /// </summary>
    public string Secret { get; init; } = "";

    /// <summary>
    /// Expected token issuer.
    /// </summary>
    public string Issuer { get; init; } = "";

    /// <summary>
    /// Expected token audience (the Auth API client name for this API).
    /// </summary>
    public string Audience { get; init; } = "";
}
