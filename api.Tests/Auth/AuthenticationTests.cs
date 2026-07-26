using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;

namespace BlogSite.Api.Tests.Auth;

public class AuthenticationTests
{
    private static readonly JsonContentFactory Json = new();

    [Theory]
    [InlineData("POST", "/api/posts")]
    [InlineData("PUT", "/api/posts/1")]
    [InlineData("DELETE", "/api/posts/1")]
    [InlineData("POST", "/api/posts/1/publish")]
    [InlineData("POST", "/api/categories")]
    [InlineData("PUT", "/api/categories/1")]
    [InlineData("DELETE", "/api/categories/1")]
    [InlineData("POST", "/api/tags")]
    [InlineData("PUT", "/api/tags/1")]
    [InlineData("DELETE", "/api/tags/1")]
    [InlineData("GET", "/api/analytics/summary")]
    [InlineData("POST", "/api/media/images")]
    public async Task ProtectedEndpoint_NoToken_Returns401(string method, string path)
    {
        using var factory = new AuthTestWebApplicationFactory();
        using var client = factory.CreateClient();

        var response = await client.SendAsync(new HttpRequestMessage(new HttpMethod(method), path));

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Theory]
    [InlineData("GET", "/api/posts")]
    [InlineData("GET", "/api/posts/1")]
    [InlineData("GET", "/api/posts/slug/some-slug")]
    [InlineData("GET", "/api/categories")]
    [InlineData("GET", "/api/categories/1")]
    [InlineData("GET", "/api/tags")]
    [InlineData("GET", "/api/tags/1")]
    [InlineData("GET", "/api/layouttemplates")]
    [InlineData("GET", "/api/layouttemplates/1")]
    public async Task PublicGetEndpoint_NoToken_IsNotUnauthorized(string method, string path)
    {
        using var factory = new AuthTestWebApplicationFactory();
        using var client = factory.CreateClient();

        var response = await client.SendAsync(new HttpRequestMessage(new HttpMethod(method), path));

        Assert.NotEqual(HttpStatusCode.Unauthorized, response.StatusCode);
        Assert.NotEqual(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task PublicPageviewEndpoint_NoToken_IsNotUnauthorized()
    {
        using var factory = new AuthTestWebApplicationFactory();
        using var client = factory.CreateClient();

        var response = await client.PostAsJsonAsync(
            "/api/analytics/pageview",
            new { postId = (int?)null, path = "/", referrer = (string?)null });

        Assert.NotEqual(HttpStatusCode.Unauthorized, response.StatusCode);
        Assert.NotEqual(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task ValidToken_ValidatorConfirmsCurrent_NotUnauthorized()
    {
        using var factory = new AuthTestWebApplicationFactory();
        factory.JtiValidator.IsValid = true;
        using var client = factory.CreateClient();
        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", TestJwtTokens.CreateValid());

        // Invalid status short-circuits before touching the repository,
        // giving a deterministic 400 while still proving auth let it through.
        var response = await client.PostAsJsonAsync(
            "/api/posts",
            new
            {
                title = "t",
                slug = "t",
                content = "c",
                status = "not-a-real-status",
                tags = Array.Empty<string>()
            });

        Assert.NotEqual(HttpStatusCode.Unauthorized, response.StatusCode);
        Assert.NotEqual(HttpStatusCode.Forbidden, response.StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task ExpiredToken_Returns401()
    {
        using var factory = new AuthTestWebApplicationFactory();
        using var client = factory.CreateClient();
        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", TestJwtTokens.CreateExpired());

        var response = await client.PostAsync("/api/posts", Json.Empty());

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task WrongSignature_Returns401()
    {
        using var factory = new AuthTestWebApplicationFactory();
        using var client = factory.CreateClient();
        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", TestJwtTokens.CreateWithWrongSignature());

        var response = await client.PostAsync("/api/posts", Json.Empty());

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task WrongIssuer_Returns401()
    {
        using var factory = new AuthTestWebApplicationFactory();
        using var client = factory.CreateClient();
        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", TestJwtTokens.CreateWithWrongIssuer());

        var response = await client.PostAsync("/api/posts", Json.Empty());

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task WrongAudience_Returns401()
    {
        using var factory = new AuthTestWebApplicationFactory();
        using var client = factory.CreateClient();
        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", TestJwtTokens.CreateWithWrongAudience());

        var response = await client.PostAsync("/api/posts", Json.Empty());

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task ValidToken_ValidatorReportsRevoked_Returns401()
    {
        using var factory = new AuthTestWebApplicationFactory();
        factory.JtiValidator.IsValid = false;
        using var client = factory.CreateClient();
        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", TestJwtTokens.CreateValid());

        var response = await client.PostAsync("/api/posts", Json.Empty());

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    private sealed class JsonContentFactory
    {
        public StringContent Empty() =>
            new("{}", System.Text.Encoding.UTF8, "application/json");
    }
}
