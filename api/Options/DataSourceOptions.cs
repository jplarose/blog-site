namespace BlogSite.Api.Options;

/// <summary>
/// PostgreSQL connection settings for the BlogSite API.
/// </summary>
public sealed class DataSourceOptions
{
    /// <summary>
    /// Database host name or IP address.
    /// </summary>
    public string? Host { get; init; }

    /// <summary>
    /// Database name.
    /// </summary>
    public string? Database { get; init; }

    /// <summary>
    /// Database user name.
    /// </summary>
    public string? User { get; init; }

    /// <summary>
    /// Database password.
    /// </summary>
    public string? Password { get; init; }
}
