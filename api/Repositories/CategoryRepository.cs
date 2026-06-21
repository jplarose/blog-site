using BlogSite.Api.DTOs;
using Dapper;
using System.Data;

namespace BlogSite.Api.Repositories;

public interface ICategoryRepository
{
    Task<IReadOnlyList<CategoryDto>> GetAllAsync(CancellationToken cancellationToken);
    Task<CategoryDto?> GetByIdAsync(int id, CancellationToken cancellationToken);
    Task<CategoryDto> CreateAsync(
        string name,
        string slug,
        string? description,
        int? defaultTemplateId,
        CancellationToken cancellationToken);
    Task<CategoryDto?> UpdateAsync(
        int id,
        string name,
        string slug,
        string? description,
        int? defaultTemplateId,
        CancellationToken cancellationToken);
    Task<bool> DeleteAsync(int id, CancellationToken cancellationToken);
}

public sealed class CategoryRepository(IDbConnection db) : ICategoryRepository
{
    private const string SelectCategorySql = """
        SELECT
            c.id AS Id,
            c.name AS Name,
            c.slug AS Slug,
            c.description AS Description,
            c.default_template_id AS DefaultTemplateId,
            template.name AS DefaultTemplateName,
            COUNT(post.id)::int AS PostCount,
            c.created_at AS CreatedAt,
            c.updated_at AS UpdatedAt
        FROM categories AS c
        LEFT JOIN layout_templates AS template
            ON template.id = c.default_template_id
        LEFT JOIN posts AS post
            ON post.category_id = c.id
        """;

    public async Task<IReadOnlyList<CategoryDto>> GetAllAsync(
        CancellationToken cancellationToken)
    {
        var command = new CommandDefinition(
            $"""
            {SelectCategorySql}
            GROUP BY
                c.id,
                template.name
            ORDER BY c.name;
            """,
            cancellationToken: cancellationToken);

        var categories = await db.QueryAsync<CategoryDto>(command);
        return categories.AsList();
    }

    public async Task<CategoryDto?> GetByIdAsync(
        int id,
        CancellationToken cancellationToken)
    {
        var command = new CommandDefinition(
            $"""
            {SelectCategorySql}
            WHERE c.id = @Id
            GROUP BY
                c.id,
                template.name;
            """,
            new { Id = id },
            cancellationToken: cancellationToken);

        return await db.QuerySingleOrDefaultAsync<CategoryDto>(command);
    }

    public async Task<CategoryDto> CreateAsync(
        string name,
        string slug,
        string? description,
        int? defaultTemplateId,
        CancellationToken cancellationToken)
    {
        const string sql = """
            INSERT INTO categories (
                name,
                slug,
                description,
                default_template_id
            )
            VALUES (
                @Name,
                @Slug,
                @Description,
                @DefaultTemplateId
            )
            RETURNING id;
            """;

        var command = new CommandDefinition(
            sql,
            new
            {
                Name = name,
                Slug = slug,
                Description = description,
                DefaultTemplateId = defaultTemplateId
            },
            cancellationToken: cancellationToken);

        var id = await db.QuerySingleAsync<int>(command);
        return (await GetByIdAsync(id, cancellationToken))!;
    }

    public async Task<CategoryDto?> UpdateAsync(
        int id,
        string name,
        string slug,
        string? description,
        int? defaultTemplateId,
        CancellationToken cancellationToken)
    {
        const string sql = """
            UPDATE categories
            SET
                name = @Name,
                slug = @Slug,
                description = @Description,
                default_template_id = @DefaultTemplateId,
                updated_at = NOW()
            WHERE id = @Id;
            """;

        var command = new CommandDefinition(
            sql,
            new
            {
                Id = id,
                Name = name,
                Slug = slug,
                Description = description,
                DefaultTemplateId = defaultTemplateId
            },
            cancellationToken: cancellationToken);

        var updated = await db.ExecuteAsync(command);
        return updated == 0 ? null : await GetByIdAsync(id, cancellationToken);
    }

    public async Task<bool> DeleteAsync(int id, CancellationToken cancellationToken)
    {
        const string sql = """
            DELETE FROM categories
            WHERE id = @Id;
            """;

        var command = new CommandDefinition(
            sql,
            new { Id = id },
            cancellationToken: cancellationToken);

        return await db.ExecuteAsync(command) > 0;
    }
}
