using System.Text.RegularExpressions;

namespace BlogSite.Api.Validation;

/// <summary>
/// Validates that a slug is URL-safe: lowercase letters, digits, and
/// hyphens only, with no leading/trailing/duplicate hyphens.
/// </summary>
public static partial class SlugValidator
{
    public static bool IsUrlSafe(string slug) => SlugPattern().IsMatch(slug);

    [GeneratedRegex("^[a-z0-9]+(-[a-z0-9]+)*$")]
    private static partial Regex SlugPattern();
}
