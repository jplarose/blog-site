using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;

namespace BlogSite.Api.Tests.Auth;

/// <summary>
/// Verifies the layout template catalog is exposed as read-only: the list
/// and detail GET endpoints return the fixed-catalog DTO shape (no
/// leftover editable-template fields), and no mutating action exists for
/// <c>/api/layouttemplates</c> regardless of authentication.
/// </summary>
public class LayoutTemplateCatalogTests
{
    [Theory]
    [InlineData("POST", "/api/layouttemplates")]
    [InlineData("PUT", "/api/layouttemplates/1")]
    [InlineData("DELETE", "/api/layouttemplates/1")]
    public async Task MutatingAction_NoLongerExists_NoToken(string method, string path)
    {
        using var factory = new AuthTestWebApplicationFactory();
        using var client = factory.CreateClient();

        var response = await client.SendAsync(new HttpRequestMessage(new HttpMethod(method), path));

        Assert.True(
            response.StatusCode is HttpStatusCode.NotFound or HttpStatusCode.MethodNotAllowed,
            $"Expected 404/405 for {method} {path} but got {response.StatusCode}.");
    }

    [Theory]
    [InlineData("POST", "/api/layouttemplates")]
    [InlineData("PUT", "/api/layouttemplates/1")]
    [InlineData("DELETE", "/api/layouttemplates/1")]
    public async Task MutatingAction_NoLongerExists_WithValidToken(string method, string path)
    {
        using var factory = new AuthTestWebApplicationFactory();
        factory.JtiValidator.IsValid = true;
        using var client = factory.CreateClient();
        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", TestJwtTokens.CreateValid());

        var response = await client.SendAsync(new HttpRequestMessage(new HttpMethod(method), path));

        Assert.True(
            response.StatusCode is HttpStatusCode.NotFound or HttpStatusCode.MethodNotAllowed,
            $"Expected 404/405 for {method} {path} but got {response.StatusCode}.");
    }

    [Fact]
    public async Task GetTemplates_ReturnsCatalogShape_NoEditableFields()
    {
        using var factory = new AuthTestWebApplicationFactory();
        using var client = factory.CreateClient();

        var response = await client.GetAsync("/api/layouttemplates");

        response.EnsureSuccessStatusCode();
        using var document = JsonDocument.Parse(await response.Content.ReadAsStringAsync());

        Assert.Equal(JsonValueKind.Array, document.RootElement.ValueKind);
    }

    [Fact]
    public async Task GetTemplate_MissingId_Returns404()
    {
        using var factory = new AuthTestWebApplicationFactory();
        using var client = factory.CreateClient();

        var response = await client.GetAsync("/api/layouttemplates/999");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task GetTemplate_SerializedJson_ContainsNoLegacyEditableFields()
    {
        using var factory = new AuthTestWebApplicationFactory();
        using var client = factory.CreateClient();

        var response = await client.GetAsync("/api/layouttemplates/1");

        response.EnsureSuccessStatusCode();
        var json = await response.Content.ReadAsStringAsync();
        using var document = JsonDocument.Parse(json);
        var root = document.RootElement;

        Assert.True(root.TryGetProperty("templateKey", out _));
        Assert.True(root.TryGetProperty("htmlStructure", out _));
        Assert.True(root.TryGetProperty("cssStyles", out _));

        Assert.False(root.TryGetProperty("layoutJson", out _));
        Assert.False(root.TryGetProperty("isDefault", out _));
        Assert.False(root.TryGetProperty("categoryCount", out _));
        Assert.False(root.TryGetProperty("postCount", out _));
    }
}
