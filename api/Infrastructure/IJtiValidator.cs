namespace BlogSite.Api.Infrastructure;

/// <summary>
/// Validates that a JWT's <c>jti</c> claim is still the current, live token
/// for a given user against the Auth API's revocation record.
/// </summary>
public interface IJtiValidator
{
    /// <summary>
    /// Checks whether <paramref name="jti"/> is the current live token
    /// identifier for <paramref name="userId"/>.
    /// </summary>
    /// <param name="userId">User identifier from the token's <c>sub</c> claim.</param>
    /// <param name="jti">Token identifier from the token's <c>jti</c> claim.</param>
    /// <param name="cancellationToken">Cancels the revocation check.</param>
    /// <returns>
    /// <c>true</c> if the Auth API confirms the jti is current; <c>false</c>
    /// if it reports the jti as revoked/superseded, or if the check could not
    /// be completed (fail closed).
    /// </returns>
    Task<bool> IsValidAsync(
        Guid userId,
        string jti,
        CancellationToken cancellationToken);
}
