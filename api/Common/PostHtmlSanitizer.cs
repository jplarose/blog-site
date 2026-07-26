using System.Net;
using Ganss.Xss;

namespace BlogSite.Api.Common;

/// <summary>
/// The single, shared HTML sanitization implementation for post content.
/// This is the API's trust boundary between admin-authored rich HTML and
/// both the stored value and the public renderer (<c>{{content}}</c>
/// injection) — see <c>docs/specs/SPEC_BACKEND.md</c> "HTML Sanitization".
/// Every write path that touches <c>posts.content</c>/<c>title</c>/
/// <c>excerpt</c> must go through this class; there is no other
/// sanitization logic anywhere else in the codebase.
/// </summary>
public interface IPostHtmlSanitizer
{
    /// <summary>
    /// Sanitizes rich HTML post content against an explicit allow-list of
    /// structural/text tags and attributes. Strips <c>&lt;script&gt;</c>,
    /// inline event handlers, <c>style</c> attributes/tags, and
    /// <c>javascript:</c>/<c>data:</c>/<c>vbscript:</c> URLs.
    /// </summary>
    string SanitizeRichHtml(string html);

    /// <summary>
    /// Strips all HTML tags/entities-decodes a value, for plain-text-like
    /// fields (title, excerpt) that must never carry markup.
    /// </summary>
    string SanitizePlainText(string text);
}

/// <inheritdoc cref="IPostHtmlSanitizer"/>
public sealed class PostHtmlSanitizer : IPostHtmlSanitizer
{
    // Explicit rich-HTML allow-list per docs/specs/SPEC_BACKEND.md /
    // issue #34 — structural and inline text-formatting tags only. No
    // scripting-capable or styling-container tags (script, style, iframe,
    // object, embed, form, etc.) are ever included here.
    private static readonly string[] AllowedRichTags =
    [
        "p", "br", "h2", "h3", "h4", "blockquote", "pre", "code",
        "ul", "ol", "li", "strong", "em", "u", "s", "a", "img",
        "figure", "figcaption", "table", "thead", "tbody", "tr", "th", "td",
        "hr", "span"
    ];

    // Global attribute allow-list. Per-tag restriction (e.g. "class" only
    // on span/code; "href"/"rel"/"target" only on "a"; "src"/"width"/
    // "height" only on "img") is enforced in PostProcessNode below, since
    // HtmlSanitizer's AllowedAttributes set is not itself tag-scoped.
    private static readonly string[] AllowedRichAttributes =
        ["href", "title", "rel", "target", "src", "alt", "width", "height", "class"];

    private static readonly HashSet<string> AttributesAllowedOnA = ["href", "title", "rel", "target"];
    private static readonly HashSet<string> AttributesAllowedOnImg = ["src", "alt", "title", "width", "height"];
    private static readonly HashSet<string> TagsAllowedClass = ["span", "code"];

    // Tags whose text content must never survive stripping (their content
    // is not "text", it's code/CSS) — dropped entirely rather than kept as
    // plain text, unlike every other disallowed tag.
    private static readonly HashSet<string> TagsWithDangerousContent = ["script", "style"];

    private readonly HtmlSanitizer richHtmlSanitizer;
    private readonly HtmlSanitizer plainTextSanitizer;

    public PostHtmlSanitizer()
    {
        richHtmlSanitizer = new HtmlSanitizer();
        richHtmlSanitizer.AllowedTags.Clear();
        richHtmlSanitizer.AllowedTags.UnionWith(AllowedRichTags);

        richHtmlSanitizer.AllowedAttributes.Clear();
        richHtmlSanitizer.AllowedAttributes.UnionWith(AllowedRichAttributes);

        // No inline CSS at all — style is not in AllowedAttributes above,
        // and <style> is not in AllowedTags, but clear the CSS allow-list
        // too so nothing sneaks through via a future attribute addition.
        richHtmlSanitizer.AllowedCssProperties.Clear();

        // http/https/relative (no scheme) + mailto for links. data:/
        // javascript:/vbscript: are excluded, which is the actual XSS
        // vector this guards against.
        richHtmlSanitizer.AllowedSchemes.Clear();
        richHtmlSanitizer.AllowedSchemes.UnionWith(["http", "https", "mailto"]);

        richHtmlSanitizer.PostProcessNode += OnPostProcessNode;

        plainTextSanitizer = new HtmlSanitizer();
        plainTextSanitizer.AllowedTags.Clear();
        plainTextSanitizer.AllowedAttributes.Clear();
        plainTextSanitizer.AllowedCssProperties.Clear();
        plainTextSanitizer.AllowedSchemes.Clear();
        // Every tag is disallowed here (title/excerpt must never carry
        // markup), but their text content must survive the strip — only
        // dangerous containers (script, style, etc.) get their content
        // dropped entirely; KeepChildNodes preserves the rest as plain
        // text.
        plainTextSanitizer.KeepChildNodes = true;
        plainTextSanitizer.RemovingTag += OnPlainTextRemovingTag;
    }

    public string SanitizeRichHtml(string html) =>
        string.IsNullOrEmpty(html) ? html : richHtmlSanitizer.Sanitize(html);

    public string SanitizePlainText(string text)
    {
        if (string.IsNullOrEmpty(text))
        {
            return text;
        }

        // Sanitize strips all tags (and dangerous tag content, e.g.
        // script/style) but re-serializes the surviving text as HTML, so
        // entities like "&" come back as "&amp;". Decode afterwards so the
        // stored/returned value is genuine plain text, not HTML-escaped
        // text, then trim the whitespace left behind by removed tags.
        var stripped = plainTextSanitizer.Sanitize(text);
        return WebUtility.HtmlDecode(stripped).Trim();
    }

    /// <summary>
    /// Enforces per-tag attribute scoping that HtmlSanitizer's global
    /// AllowedAttributes set can't express, restricts <c>mailto:</c> to
    /// links only (never image <c>src</c>), and forces
    /// <c>rel="noopener noreferrer"</c> whenever a link has a
    /// <c>target</c> attribute so a target-carrying link can never be used
    /// for a reverse-tabnabbing attack against this origin.
    /// </summary>
    private static void OnPostProcessNode(object? sender, PostProcessNodeEventArgs e)
    {
        if (e.Node is not AngleSharp.Dom.IElement element)
        {
            return;
        }

        var tagName = element.TagName.ToLowerInvariant();

        foreach (var attribute in element.Attributes.ToList())
        {
            var attributeName = attribute.Name.ToLowerInvariant();
            var allowedForTag = tagName switch
            {
                "a" => AttributesAllowedOnA.Contains(attributeName),
                "img" => AttributesAllowedOnImg.Contains(attributeName),
                _ => false
            };

            if (attributeName == "class")
            {
                allowedForTag = TagsAllowedClass.Contains(tagName);
            }

            if (!allowedForTag)
            {
                element.RemoveAttribute(attribute.Name);
            }
        }

        if (tagName == "img"
            && element.GetAttribute("src") is { } src
            && src.StartsWith("mailto:", StringComparison.OrdinalIgnoreCase))
        {
            element.RemoveAttribute("src");
        }

        if (tagName == "a" && element.HasAttribute("target"))
        {
            element.SetAttribute("rel", "noopener noreferrer");
        }
    }

    /// <summary>
    /// With <see cref="HtmlSanitizer.KeepChildNodes"/> enabled, a removed
    /// tag's text content is preserved by default — correct for ordinary
    /// tags (e.g. <c>&lt;b&gt;</c>) but wrong for <see cref="TagsWithDangerousContent"/>,
    /// whose "content" is script/CSS, not prose. Clear it before removal so
    /// none of it leaks into the plain-text result.
    /// </summary>
    private static void OnPlainTextRemovingTag(object? sender, RemovingTagEventArgs e)
    {
        if (TagsWithDangerousContent.Contains(e.Tag.TagName.ToLowerInvariant()))
        {
            e.Tag.TextContent = string.Empty;
        }
    }
}
