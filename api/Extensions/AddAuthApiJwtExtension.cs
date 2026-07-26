using System.Text;
using BlogSite.Api.Infrastructure;
using BlogSite.Api.Options;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;

namespace BlogSite.Api.Extensions;

/// <summary>
/// Registers JWT bearer authentication against the shared Auth API,
/// including revocation checks against its jti validation endpoint.
/// </summary>
public static class AddAuthApiJwtExtension
{
    /// <summary>
    /// Adds JWT bearer authentication configured from the <c>Auth</c>
    /// configuration section, and wires up jti revocation validation on
    /// every successful token validation. Authentication fails closed if
    /// the Auth API cannot be reached.
    /// </summary>
    public static IServiceCollection AddAuthApiJwt(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        services.AddOptions<AuthOptions>()
            .Bind(configuration.GetSection(AuthOptions.SectionName))
            .Validate(
                options => Encoding.UTF8.GetByteCount(options.Jwt.Secret) >= 32,
                "Auth:Jwt:Secret is required and must be at least 32 bytes for HS256 signing.")
            .Validate(
                options => !string.IsNullOrWhiteSpace(options.Jwt.Issuer),
                "Auth:Jwt:Issuer is required.")
            .Validate(
                options => !string.IsNullOrWhiteSpace(options.Jwt.Audience),
                "Auth:Jwt:Audience is required.")
            .Validate(
                options => IsAbsoluteHttpUrl(options.BaseUrl),
                "Auth:BaseUrl must be an absolute HTTP or HTTPS URL.")
            .ValidateOnStart();

        services.AddHttpClient<IJtiValidator, AuthApiJtiValidator>();

        services.AddAuthorization();

        services
            .AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
            .AddJwtBearer();

        services
            .AddOptions<JwtBearerOptions>(JwtBearerDefaults.AuthenticationScheme)
            .Configure<IOptions<AuthOptions>>(ConfigureJwtBearerOptions);

        return services;
    }

    private static void ConfigureJwtBearerOptions(
        JwtBearerOptions jwtOptions,
        IOptions<AuthOptions> authOptionsAccessor)
    {
        var authOptions = authOptionsAccessor.Value;

        // The shared Auth API issues short claim names (sub, role, jti).
        // Without this, the handler silently remaps them to long claim URIs
        // and downstream claim lookups fail.
        jwtOptions.MapInboundClaims = false;

        jwtOptions.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = new SymmetricSecurityKey(
                Encoding.UTF8.GetBytes(authOptions.Jwt.Secret)),
            ValidateIssuer = true,
            ValidIssuer = authOptions.Jwt.Issuer,
            ValidateAudience = true,
            ValidAudience = authOptions.Jwt.Audience,
            ValidateLifetime = true,
            NameClaimType = "sub",
            RoleClaimType = "role"
        };

        jwtOptions.Events = new JwtBearerEvents
        {
            OnTokenValidated = OnTokenValidatedAsync
        };
    }

    private static async Task OnTokenValidatedAsync(TokenValidatedContext context)
    {
        var subClaim = context.Principal?.FindFirst("sub")?.Value;
        var jtiClaim = context.Principal?.FindFirst("jti")?.Value;

        if (!Guid.TryParse(subClaim, out var userId) || string.IsNullOrWhiteSpace(jtiClaim))
        {
            context.Fail("Token is missing required sub or jti claims.");
            return;
        }

        var jtiValidator = context.HttpContext.RequestServices
            .GetRequiredService<IJtiValidator>();

        var isValid = await jtiValidator.IsValidAsync(
            userId,
            jtiClaim,
            context.HttpContext.RequestAborted);

        if (!isValid)
        {
            context.Fail("Token has been revoked.");
        }
    }

    private static bool IsAbsoluteHttpUrl(string value) =>
        Uri.TryCreate(value, UriKind.Absolute, out var uri)
        && (uri.Scheme == Uri.UriSchemeHttp || uri.Scheme == Uri.UriSchemeHttps);
}
