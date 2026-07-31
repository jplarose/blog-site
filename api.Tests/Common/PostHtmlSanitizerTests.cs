using BlogSite.Api.Common;

namespace BlogSite.Api.Tests.Common;

/// <summary>
/// Unit tests for the single, shared HTML sanitizer used at the API's
/// write boundary for post content (issue #34). These exercise the
/// sanitizer directly; <see cref="BlogSite.Api.Tests.Auth.PostSanitizationTests"/>
/// covers the same hostile inputs end to end through the real controller/
/// service pipeline, asserting the value that reaches the repository.
/// </summary>
public class PostHtmlSanitizerTests
{
    private readonly IPostHtmlSanitizer sanitizer = new PostHtmlSanitizer();

    [Fact]
    public void SanitizeRichHtml_ScriptTag_IsRemoved()
    {
        var result = sanitizer.SanitizeRichHtml("<p>hello</p><script>alert(1)</script>");

        Assert.DoesNotContain("script", result, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("alert(1)", result);
        Assert.Contains("<p>hello</p>", result);
    }

    [Fact]
    public void SanitizeRichHtml_ImgOnError_StripsEventHandler()
    {
        var result = sanitizer.SanitizeRichHtml("<img src=\"a.png\" onerror=\"alert(1)\">");

        Assert.DoesNotContain("onerror", result, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("alert(1)", result);
    }

    [Fact]
    public void SanitizeRichHtml_JavascriptHref_IsStripped()
    {
        var result = sanitizer.SanitizeRichHtml("<a href=\"javascript:alert(1)\">click</a>");

        Assert.DoesNotContain("javascript:", result, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public void SanitizeRichHtml_DataImageSrc_IsStripped()
    {
        var result = sanitizer.SanitizeRichHtml(
            "<img src=\"data:image/png;base64,AAAA\" alt=\"x\">");

        Assert.DoesNotContain("data:image", result, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public void SanitizeRichHtml_InlineOnClick_IsStripped()
    {
        var result = sanitizer.SanitizeRichHtml("<p onclick=\"doEvil()\">text</p>");

        Assert.DoesNotContain("onclick", result, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("doEvil", result);
    }

    [Fact]
    public void SanitizeRichHtml_StyleTagAndAttribute_AreStripped()
    {
        var result = sanitizer.SanitizeRichHtml(
            "<style>body{background:url(javascript:alert(1))}</style>" +
            "<p style=\"color:red\">text</p>");

        Assert.DoesNotContain("<style", result, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("style=", result, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public void SanitizeRichHtml_NestedMangledScriptTag_IsNeutralized()
    {
        var result = sanitizer.SanitizeRichHtml("<scr<script>ipt>alert(1)</scr</script>ipt>");

        Assert.DoesNotContain("<script", result, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("alert(1)", result);
    }

    [Fact]
    public void SanitizeRichHtml_LegitimateRichContent_PassesThroughIntact()
    {
        const string html =
            "<h2>Title</h2><p>Some <strong>bold</strong> and <em>em</em> text.</p>" +
            "<ul><li>one</li><li>two</li></ul>" +
            "<a href=\"https://example.com\">link</a>" +
            "<img src=\"https://example.com/a.png\" alt=\"a\">" +
            "<pre><code class=\"language-csharp\">var x = 1;</code></pre>";

        var result = sanitizer.SanitizeRichHtml(html);

        Assert.Contains("<h2>Title</h2>", result);
        Assert.Contains("<strong>bold</strong>", result);
        Assert.Contains("<li>one</li>", result);
        Assert.Contains("href=\"https://example.com\"", result);
        Assert.Contains("src=\"https://example.com/a.png\"", result);
        Assert.Contains("language-csharp", result);
    }

    [Fact]
    public void SanitizeRichHtml_LinkWithTarget_ForcesRelNoopenerNoreferrer()
    {
        var result = sanitizer.SanitizeRichHtml(
            "<a href=\"https://example.com\" target=\"_blank\">link</a>");

        Assert.Contains("rel=\"noopener noreferrer\"", result);
    }

    [Fact]
    public void SanitizeRichHtml_MailtoLink_IsAllowed()
    {
        var result = sanitizer.SanitizeRichHtml("<a href=\"mailto:a@example.com\">email</a>");

        Assert.Contains("mailto:a@example.com", result);
    }

    [Fact]
    public void SanitizePlainText_StripsAllTags()
    {
        var result = sanitizer.SanitizePlainText("<b>Bold</b> <script>alert(1)</script>Title");

        Assert.DoesNotContain("<", result);
        Assert.Contains("Bold", result);
        Assert.Contains("Title", result);
        Assert.DoesNotContain("alert(1)", result);
    }

    [Fact]
    public void SanitizePlainText_PlainAmpersand_IsUnchanged()
    {
        var result = sanitizer.SanitizePlainText("Dogs & Cats");

        Assert.Equal("Dogs & Cats", result);
    }

    [Fact]
    public void SanitizePlainText_EncodedEntity_IsDecodedNotReEncoded()
    {
        var result = sanitizer.SanitizePlainText("<b>Hi &amp; bye</b>");

        Assert.Equal("Hi & bye", result);
    }

    [Fact]
    public void SanitizePlainText_ScriptContent_IsRemovedEntirely()
    {
        var result = sanitizer.SanitizePlainText("Before<script>alert('x & y')</script>After");

        Assert.Equal("BeforeAfter", result);
        Assert.DoesNotContain("alert", result);
        Assert.DoesNotContain("script", result, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public void SanitizeRichHtml_RelativeAnchorHref_SurvivesIntact()
    {
        var result = sanitizer.SanitizeRichHtml("<a href=\"/about\">about</a>");

        Assert.Contains("href=\"/about\"", result);
    }

    [Fact]
    public void SanitizeRichHtml_RelativeImgSrc_SurvivesIntact()
    {
        var result = sanitizer.SanitizeRichHtml("<img src=\"/images/x.png\" alt=\"x\">");

        Assert.Contains("src=\"/images/x.png\"", result);
    }

    [Fact]
    public void SanitizeRichHtml_DotDotRelativeHref_SurvivesIntact()
    {
        var result = sanitizer.SanitizeRichHtml("<a href=\"../relative\">rel</a>");

        Assert.Contains("href=\"../relative\"", result);
    }

    [Fact]
    public void SanitizeRichHtml_MailtoImgSrc_IsStripped()
    {
        var result = sanitizer.SanitizeRichHtml("<img src=\"mailto:x@y.z\" alt=\"x\">");

        Assert.DoesNotContain("mailto:", result, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public void SanitizeRichHtml_MailtoAnchorHref_IsKept()
    {
        var result = sanitizer.SanitizeRichHtml("<a href=\"mailto:x@y.z\">email</a>");

        Assert.Contains("href=\"mailto:x@y.z\"", result);
    }

    [Fact]
    public void SanitizeRichHtml_BlockquoteHrUS_PassThroughIntact()
    {
        var result = sanitizer.SanitizeRichHtml(
            "<blockquote>quote</blockquote><hr><u>underline</u><s>strike</s>");

        Assert.Contains("<blockquote>quote</blockquote>", result);
        Assert.Contains("<hr>", result);
        Assert.Contains("<u>underline</u>", result);
        Assert.Contains("<s>strike</s>", result);
    }

    [Fact]
    public void SanitizeRichHtml_TableFragment_PassesThroughIntact()
    {
        const string html =
            "<table><thead><tr><th>H</th></tr></thead>" +
            "<tbody><tr><td>D</td></tr></tbody></table>";

        var result = sanitizer.SanitizeRichHtml(html);

        Assert.Contains("<table>", result);
        Assert.Contains("<thead>", result);
        Assert.Contains("<tr><th>H</th></tr>", result);
        Assert.Contains("<tbody>", result);
        Assert.Contains("<tr><td>D</td></tr>", result);
    }
}
