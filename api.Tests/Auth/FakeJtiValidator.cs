using BlogSite.Api.Infrastructure;

namespace BlogSite.Api.Tests.Auth;

/// <summary>
/// Controllable stand-in for the real Auth API revocation check, so
/// integration tests can force a token to be treated as current or
/// revoked without a live Auth API.
/// </summary>
internal sealed class FakeJtiValidator : IJtiValidator
{
    public bool IsValid { get; set; } = true;

    public Task<bool> IsValidAsync(
        Guid userId,
        string jti,
        CancellationToken cancellationToken) =>
        Task.FromResult(IsValid);
}
