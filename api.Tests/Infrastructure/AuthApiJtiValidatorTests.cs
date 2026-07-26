using System.Net;
using System.Text.Json;
using BlogSite.Api.Infrastructure;
using BlogSite.Api.Options;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;

namespace BlogSite.Api.Tests.Infrastructure;

public class AuthApiJtiValidatorTests
{
    private static readonly Guid UserId = Guid.Parse("11111111-1111-1111-1111-111111111111");
    private const string Jti = "test-jti-value";

    [Fact]
    public async Task IsValidAsync_SendsExpectedPathBodyAndApiKeyHeader()
    {
        HttpRequestMessage? capturedRequest = null;
        string? capturedBody = null;
        var handler = new FakeHttpMessageHandler(async request =>
        {
            capturedRequest = request;
            capturedBody = request.Content is null
                ? null
                : await request.Content.ReadAsStringAsync();
            return new HttpResponseMessage(HttpStatusCode.OK);
        });

        var validator = CreateValidator(handler, apiKey: "secret-api-key");

        await validator.IsValidAsync(UserId, Jti, CancellationToken.None);

        Assert.NotNull(capturedRequest);
        Assert.Equal(HttpMethod.Post, capturedRequest!.Method);
        Assert.Equal("/Auth/validate-jti", capturedRequest.RequestUri!.AbsolutePath);
        Assert.True(capturedRequest.Headers.TryGetValues("X-Api-Key", out var apiKeyValues));
        Assert.Equal("secret-api-key", Assert.Single(apiKeyValues!));

        Assert.NotNull(capturedBody);
        using var json = JsonDocument.Parse(capturedBody!);
        Assert.Equal(UserId.ToString(), json.RootElement.GetProperty("userId").GetString());
        Assert.Equal(Jti, json.RootElement.GetProperty("jti").GetString());
    }

    [Fact]
    public async Task IsValidAsync_UpstreamReturns200_ReturnsTrue()
    {
        var handler = new FakeHttpMessageHandler(_ =>
            Task.FromResult(new HttpResponseMessage(HttpStatusCode.OK)));
        var validator = CreateValidator(handler);

        var result = await validator.IsValidAsync(UserId, Jti, CancellationToken.None);

        Assert.True(result);
    }

    [Fact]
    public async Task IsValidAsync_UpstreamReturns401_ReturnsFalse()
    {
        var handler = new FakeHttpMessageHandler(_ =>
            Task.FromResult(new HttpResponseMessage(HttpStatusCode.Unauthorized)));
        var validator = CreateValidator(handler);

        var result = await validator.IsValidAsync(UserId, Jti, CancellationToken.None);

        Assert.False(result);
    }

    [Fact]
    public async Task IsValidAsync_UpstreamThrows_ReturnsFalse()
    {
        var handler = new FakeHttpMessageHandler(_ =>
            throw new HttpRequestException("connection refused"));
        var validator = CreateValidator(handler);

        var result = await validator.IsValidAsync(UserId, Jti, CancellationToken.None);

        Assert.False(result);
    }

    [Fact]
    public async Task IsValidAsync_UpstreamTimesOut_ReturnsFalse()
    {
        var handler = new FakeHttpMessageHandler(_ =>
            throw new TaskCanceledException("timed out"));
        var validator = CreateValidator(handler);

        var result = await validator.IsValidAsync(UserId, Jti, CancellationToken.None);

        Assert.False(result);
    }

    private static AuthApiJtiValidator CreateValidator(
        HttpMessageHandler handler,
        string apiKey = "") =>
        new(
            new HttpClient(handler) { BaseAddress = new Uri("http://auth.test") },
            Microsoft.Extensions.Options.Options.Create(new AuthOptions { ApiKey = apiKey }),
            NullLogger<AuthApiJtiValidator>.Instance);

    private sealed class FakeHttpMessageHandler(
        Func<HttpRequestMessage, Task<HttpResponseMessage>> handle) : HttpMessageHandler
    {
        protected override Task<HttpResponseMessage> SendAsync(
            HttpRequestMessage request,
            CancellationToken cancellationToken) =>
            handle(request);
    }
}
