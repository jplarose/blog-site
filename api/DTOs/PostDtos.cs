namespace BlogSite.Api.DTOs;

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
    string? TemplateKey,
    string? TemplateName,
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
    string? TemplateKey,
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
    IReadOnlyList<int> TagIds
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
    IReadOnlyList<int> TagIds
);

/// <summary>
/// Request to schedule a post to go live at a future time.
/// ScheduledAt uses DateTimeOffset so the wire contract is unambiguous about
/// the intended instant, regardless of whether the client sends a UTC or
/// offset-local timestamp (an offset-less payload would otherwise be
/// silently treated as UTC).
/// </summary>
public record ScheduleRequest(DateTimeOffset? ScheduledAt);
