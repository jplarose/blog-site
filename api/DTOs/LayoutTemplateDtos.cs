namespace BlogSite.Api.DTOs;

/// <summary>Summary view of a fixed catalog layout template for list display.</summary>
public record LayoutTemplateSummaryDto(
    int Id,
    string TemplateKey,
    string Name,
    string Description
);

/// <summary>Full catalog layout template, including renderable markup and styles.</summary>
public record LayoutTemplateDto(
    int Id,
    string TemplateKey,
    string Name,
    string Description,
    string HtmlStructure,
    string CssStyles
);
