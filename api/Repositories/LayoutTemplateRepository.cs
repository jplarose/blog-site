using BlogSite.Api.DTOs;
using Dapper;
using System.Data;
using System.Text.Json;

namespace BlogSite.Api.Repositories;

public interface ILayoutTemplateRepository
{
    Task<IReadOnlyList<LayoutTemplateSummaryDto>> GetAllAsync(
        CancellationToken cancellationToken);
    Task<LayoutTemplateDto?> GetByIdAsync(int id, CancellationToken cancellationToken);
    Task<LayoutTemplateDto> CreateAsync(
        string name,
        string description,
        JsonElement layout,
        bool isDefault,
        CancellationToken cancellationToken);
    Task<LayoutTemplateDto?> UpdateAsync(
        int id,
        string name,
        string description,
        JsonElement layout,
        bool isDefault,
        CancellationToken cancellationToken);
    Task<bool> DeleteAsync(int id, CancellationToken cancellationToken);
}

public sealed class LayoutTemplateRepository(IDbConnection db) : ILayoutTemplateRepository
{
    public async Task<IReadOnlyList<LayoutTemplateSummaryDto>> GetAllAsync(
        CancellationToken cancellationToken)
    {
        const string sql = """
            SELECT
                template.id AS Id,
                template.name AS Name,
                template.description AS Description,
                template.is_default AS IsDefault,
                COUNT(DISTINCT category.id)::int AS CategoryCount,
                COUNT(DISTINCT post.id)::int AS PostCount,
                template.created_at AS CreatedAt,
                template.updated_at AS UpdatedAt
            FROM layout_templates AS template
            LEFT JOIN categories AS category
                ON category.default_template_id = template.id
            LEFT JOIN posts AS post
                ON post.template_id = template.id
            GROUP BY template.id
            ORDER BY template.name;
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
                name AS Name,
                description AS Description,
                layout_json::text AS LayoutJson,
                is_default AS IsDefault,
                created_at AS CreatedAt,
                updated_at AS UpdatedAt
            FROM layout_templates
            WHERE id = @Id;
            """;

        var command = new CommandDefinition(
            sql,
            new { Id = id },
            cancellationToken: cancellationToken);

        var row = await db.QuerySingleOrDefaultAsync<LayoutTemplateRow>(command);
        return row?.ToDto();
    }

    public async Task<LayoutTemplateDto> CreateAsync(
        string name,
        string description,
        JsonElement layout,
        bool isDefault,
        CancellationToken cancellationToken)
    {
        await RepositoryConnection.EnsureOpenAsync(db, cancellationToken);
        using var transaction = db.BeginTransaction();

        if (isDefault)
        {
            await ClearDefaultAsync(null, transaction, cancellationToken);
        }

        const string sql = """
            INSERT INTO layout_templates (
                name,
                description,
                layout_json,
                is_default
            )
            VALUES (
                @Name,
                @Description,
                CAST(@LayoutJson AS jsonb),
                @IsDefault
            )
            RETURNING id;
            """;

        var command = new CommandDefinition(
            sql,
            new
            {
                Name = name,
                Description = description,
                LayoutJson = layout.GetRawText(),
                IsDefault = isDefault
            },
            transaction,
            cancellationToken: cancellationToken);

        var id = await db.QuerySingleAsync<int>(command);
        transaction.Commit();

        return (await GetByIdAsync(id, cancellationToken))!;
    }

    public async Task<LayoutTemplateDto?> UpdateAsync(
        int id,
        string name,
        string description,
        JsonElement layout,
        bool isDefault,
        CancellationToken cancellationToken)
    {
        await RepositoryConnection.EnsureOpenAsync(db, cancellationToken);
        using var transaction = db.BeginTransaction();

        if (isDefault)
        {
            await ClearDefaultAsync(id, transaction, cancellationToken);
        }

        const string sql = """
            UPDATE layout_templates
            SET
                name = @Name,
                description = @Description,
                layout_json = CAST(@LayoutJson AS jsonb),
                is_default = @IsDefault,
                updated_at = NOW()
            WHERE id = @Id;
            """;

        var command = new CommandDefinition(
            sql,
            new
            {
                Id = id,
                Name = name,
                Description = description,
                LayoutJson = layout.GetRawText(),
                IsDefault = isDefault
            },
            transaction,
            cancellationToken: cancellationToken);

        var updated = await db.ExecuteAsync(command);
        if (updated == 0)
        {
            transaction.Rollback();
            return null;
        }

        transaction.Commit();

        return await GetByIdAsync(id, cancellationToken);
    }

    public async Task<bool> DeleteAsync(int id, CancellationToken cancellationToken)
    {
        const string sql = """
            DELETE FROM layout_templates
            WHERE id = @Id;
            """;

        var command = new CommandDefinition(
            sql,
            new { Id = id },
            cancellationToken: cancellationToken);

        return await db.ExecuteAsync(command) > 0;
    }

    private async Task ClearDefaultAsync(
        int? exceptId,
        IDbTransaction transaction,
        CancellationToken cancellationToken)
    {
        const string sql = """
            UPDATE layout_templates
            SET
                is_default = FALSE,
                updated_at = NOW()
            WHERE is_default = TRUE
                AND (@ExceptId IS NULL OR id <> @ExceptId);
            """;

        var command = new CommandDefinition(
            sql,
            new { ExceptId = exceptId },
            transaction,
            cancellationToken: cancellationToken);

        await db.ExecuteAsync(command);
    }

    private sealed record LayoutTemplateRow(
        int Id,
        string Name,
        string Description,
        string LayoutJson,
        bool IsDefault,
        DateTime CreatedAt,
        DateTime UpdatedAt)
    {
        public LayoutTemplateDto ToDto()
        {
            using var document = JsonDocument.Parse(LayoutJson);
            return new LayoutTemplateDto(
                Id,
                Name,
                Description,
                document.RootElement.Clone(),
                IsDefault,
                CreatedAt,
                UpdatedAt);
        }
    }
}
