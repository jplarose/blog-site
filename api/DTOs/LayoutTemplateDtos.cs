using System.Text.Json;

namespace BlogSite.Api.DTOs;

public record LayoutTemplateSummaryDto(
    int Id,
    string Name,
    string Description,
    bool IsDefault,
    int CategoryCount,
    int PostCount,
    DateTime CreatedAt,
    DateTime UpdatedAt
);

public record LayoutTemplateDto(
    int Id,
    string Name,
    string Description,
    JsonElement Layout,
    bool IsDefault,
    DateTime CreatedAt,
    DateTime UpdatedAt
);

public record CreateLayoutTemplateRequest(
    string Name,
    string Description,
    JsonElement Layout,
    bool IsDefault
);

public record UpdateLayoutTemplateRequest(
    string Name,
    string Description,
    JsonElement Layout,
    bool IsDefault
);
