namespace BlogSite.Api.DTOs;

public record CategoryDto(
    int Id,
    string Name,
    string Slug,
    string? Description,
    int PostCount,
    DateTime CreatedAt,
    DateTime UpdatedAt
);

public record CreateCategoryRequest(
    string Name,
    string Slug,
    string? Description
);

public record UpdateCategoryRequest(
    string Name,
    string Slug,
    string? Description
);
