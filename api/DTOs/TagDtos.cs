namespace BlogSite.Api.DTOs;

public record TagDto(
    int Id,
    string Name,
    string Slug,
    int PostCount,
    DateTime CreatedAt
);

public record CreateTagRequest(string Name, string Slug);

public record UpdateTagRequest(string Name, string Slug);
