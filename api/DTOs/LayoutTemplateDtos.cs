namespace BlogSite.Api.DTOs;

public record LayoutTemplateDto(
    int Id,
    string Name,
    string Description,
    string HtmlStructure,
    string CssStyles,
    bool IsDefault,
    DateTime CreatedAt,
    DateTime UpdatedAt
);

public record CreateLayoutTemplateRequest(
    string Name,
    string Description,
    string HtmlStructure,
    string CssStyles,
    bool IsDefault
);

public record UpdateLayoutTemplateRequest(
    string Name,
    string Description,
    string HtmlStructure,
    string CssStyles,
    bool IsDefault
);
