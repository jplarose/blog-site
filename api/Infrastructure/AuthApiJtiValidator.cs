using System.Net.Http.Json;
using System.Text.Json;
using BlogSite.Api.Options;
using Microsoft.Extensions.Options;

namespace BlogSite.Api.Infrastructure;

/// <summary>
/// Checks token revocation against the shared Auth API's
/// <c>POST /Auth/validate-jti</c> endpoint.
/// </summary>
public sealed class AuthApiJtiValidator(
    HttpClient httpClient,
    IOptions<AuthOptions> authOptions,
    ILogger<AuthApiJtiValidator> logger) : IJtiValidator
{
    private static readonly JsonSerializerOptions RequestSerializerOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase
    };

    public async Task<bool> IsValidAsync(
        Guid userId,
        string jti,
        CancellationToken cancellationToken)
    {
        try
        {
            using var request = new HttpRequestMessage(HttpMethod.Post, "/Auth/validate-jti")
            {
                Content = JsonContent.Create(
                    new ValidateJtiRequest(userId, jti),
                    options: RequestSerializerOptions)
            };
            request.Headers.Add("X-Api-Key", authOptions.Value.ApiKey);

            using var response = await httpClient.SendAsync(request, cancellationToken);
            return response.IsSuccessStatusCode;
        }
        catch (Exception exception) when (
            exception is HttpRequestException
            or TaskCanceledException
            or TimeoutException)
        {
            // Fail closed: if the Auth API cannot be reached, treat the
            // token as revoked rather than allowing access.
            logger.LogWarning(
                exception,
                "Auth API jti validation request failed; treating token as invalid.");
            return false;
        }
    }

    private sealed record ValidateJtiRequest(Guid UserId, string Jti);
}
