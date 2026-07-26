using BlogSite.Api.DTOs;
using Dapper;
using System.Data;

namespace BlogSite.Api.Repositories;

/// <summary>
/// Read-only access to the fixed layout template catalog. The catalog is
/// application-managed and seeded (<c>sql/seeds/002_catalog_templates.sql</c>);
/// no method here may create, update, or delete <c>layout_templates</c> rows.
/// </summary>
public interface ILayoutTemplateRepository
{
    Task<IReadOnlyList<LayoutTemplateSummaryDto>> GetAllAsync(
        CancellationToken cancellationToken);
    Task<LayoutTemplateDto?> GetByIdAsync(int id, CancellationToken cancellationToken);
    Task<bool> ExistsAsync(int id, CancellationToken cancellationToken);
}

public sealed class LayoutTemplateRepository(IDbConnection db) : ILayoutTemplateRepository
{
    public async Task<IReadOnlyList<LayoutTemplateSummaryDto>> GetAllAsync(
        CancellationToken cancellationToken)
    {
        const string sql = """
            SELECT
                id AS Id,
                template_key AS TemplateKey,
                name AS Name,
                description AS Description
            FROM layout_templates
            ORDER BY name;
            """;

        var command = new CommandDefinition(sql, cancellationToken: cancellationToken);
        var templates = await db.QueryAsync<LayoutTemplateSummaryDto>(command);
        return templates.AsList();
    }

    public async Task<LayoutTemplateDto?> GetByIdAsync(
        int id,
        CancellationToken cancellationToken)
    {
        const string sql = """
            SELECT
                id AS Id,
                template_key AS TemplateKey,
                name AS Name,
                description AS Description,
                html_structure AS HtmlStructure,
                css_styles AS CssStyles
            FROM layout_templates
            WHERE id = @Id;
            """;

        var command = new CommandDefinition(
            sql,
            new { Id = id },
            cancellationToken: cancellationToken);

        return await db.QuerySingleOrDefaultAsync<LayoutTemplateDto>(command);
    }

    public async Task<bool> ExistsAsync(int id, CancellationToken cancellationToken)
    {
        const string sql = """
            SELECT EXISTS (
                SELECT 1
                FROM layout_templates
                WHERE id = @Id
            );
            """;

        var command = new CommandDefinition(
            sql,
            new { Id = id },
            cancellationToken: cancellationToken);

        return await db.ExecuteScalarAsync<bool>(command);
    }
}
