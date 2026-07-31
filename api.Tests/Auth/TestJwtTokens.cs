using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Microsoft.IdentityModel.Tokens;

namespace BlogSite.Api.Tests.Auth;

/// <summary>
/// Mints HS256 JWTs matching the shared Auth API's contract, for use
/// against the dev placeholder secret/issuer/audience configured in
/// <c>appsettings.Development.json</c> (loaded by the test host).
/// </summary>
internal static class TestJwtTokens
{
    public const string Secret = "dev-only-blogsite-signing-key-not-a-real-secret-0123456789";
    public const string Issuer = "auth.jlarose.me";
    public const string Audience = "blogsite";

    public static string CreateValid(
        Guid? userId = null,
        string role = "admin",
        string? jti = null) =>
        Create(
            Secret,
            Issuer,
            Audience,
            userId ?? Guid.NewGuid(),
            role,
            jti ?? Guid.NewGuid().ToString(),
            DateTime.UtcNow.AddMinutes(-1),
            DateTime.UtcNow.AddMinutes(5));

    public static string CreateExpired() =>
        Create(
            Secret,
            Issuer,
            Audience,
            Guid.NewGuid(),
            "admin",
            Guid.NewGuid().ToString(),
            DateTime.UtcNow.AddMinutes(-10),
            DateTime.UtcNow.AddMinutes(-5));

    public static string CreateWithWrongSignature() =>
        Create(
            "a-completely-different-signing-secret-not-matching-the-server-0123456789",
            Issuer,
            Audience,
            Guid.NewGuid(),
            "admin",
            Guid.NewGuid().ToString(),
            DateTime.UtcNow.AddMinutes(-1),
            DateTime.UtcNow.AddMinutes(5));

    public static string CreateWithWrongIssuer() =>
        Create(
            Secret,
            "https://not-the-real-issuer.example",
            Audience,
            Guid.NewGuid(),
            "admin",
            Guid.NewGuid().ToString(),
            DateTime.UtcNow.AddMinutes(-1),
            DateTime.UtcNow.AddMinutes(5));

    public static string CreateWithWrongAudience() =>
        Create(
            Secret,
            Issuer,
            "some-other-client",
            Guid.NewGuid(),
            "admin",
            Guid.NewGuid().ToString(),
            DateTime.UtcNow.AddMinutes(-1),
            DateTime.UtcNow.AddMinutes(5));

    private static string Create(
        string secret,
        string issuer,
        string audience,
        Guid userId,
        string role,
        string jti,
        DateTime notBefore,
        DateTime expires)
    {
        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(secret));
        var credentials = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

        var claims = new[]
        {
            new Claim("sub", userId.ToString()),
            new Claim("role", role),
            new Claim("jti", jti)
        };

        var token = new JwtSecurityToken(
            issuer,
            audience,
            claims,
            notBefore: notBefore,
            expires: expires,
            signingCredentials: credentials);

        return new JwtSecurityTokenHandler().WriteToken(token);
    }
}
