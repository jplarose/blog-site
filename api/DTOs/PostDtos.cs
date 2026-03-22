using System.Text.Json;

namespace BlogSite.Api.DTOs;

public record PostTemplateContentDto(
    int TemplateId,
    IReadOnlyDictionary<string, JsonElement> Values
);

public record PostDto(
    int Id,
    string Title,
    string Slug,
    string Content,
    string? Excerpt,
    string? FeaturedImageUrl,
    string Status,
    DateTime? PublishedAt,
    DateTime? ScheduledAt,
    int? CategoryId,
    string? CategoryName,
    int? TemplateId,
    string? TemplateName,
    PostTemplateContentDto? TemplateContent,
    IEnumerable<string> Tags,
    DateTime CreatedAt,
    DateTime UpdatedAt
);

public record PostSummaryDto(
    int Id,
    string Title,
    string Slug,
    string? Excerpt,
    string? FeaturedImageUrl,
    string Status,
    DateTime? PublishedAt,
    DateTime? ScheduledAt,
    int? CategoryId,
    string? CategoryName,
    int? TemplateId,
    string? TemplateName,
    IEnumerable<string> Tags,
    DateTime CreatedAt,
    DateTime UpdatedAt
);

public record CreatePostRequest(
    string Title,
    string Slug,
    string Content,
    string? Excerpt,
    string? FeaturedImageUrl,
    string Status,
    DateTime? ScheduledAt,
    int? CategoryId,
    int? TemplateId,
    PostTemplateContentDto? TemplateContent,
    IEnumerable<string> Tags
);

public record UpdatePostRequest(
    string Title,
    string Slug,
    string Content,
    string? Excerpt,
    string? FeaturedImageUrl,
    string Status,
    DateTime? ScheduledAt,
    int? CategoryId,
    int? TemplateId,
    PostTemplateContentDto? TemplateContent,
    IEnumerable<string> Tags
);
