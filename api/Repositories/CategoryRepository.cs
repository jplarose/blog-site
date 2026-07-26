using BlogSite.Api.DTOs;
using Dapper;
using System.Data;

namespace BlogSite.Api.Repositories;

public interface ICategoryRepository
{
    Task<IReadOnlyList<CategoryDto>> GetAllAsync(CancellationToken cancellationToken);
    Task<CategoryDto?> GetByIdAsync(int id, CancellationToken cancellationToken);
    Task<bool> NameExistsAsync(
        string name,
        int? excludeId,
        CancellationToken cancellationToken);
    Task<bool> SlugExistsAsync(
        string slug,
        int? excludeId,
        CancellationToken cancellationToken);
    Task<CategoryDto> CreateAsync(
        string name,
        string slug,
        string? description,
        CancellationToken cancellationToken);
    Task<CategoryDto?> UpdateAsync(
        int id,
        string name,
        string slug,
        string? description,
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
            COUNT(post.id)::int AS PostCount,
            c.created_at AS CreatedAt,
            c.updated_at AS UpdatedAt
        FROM categories AS c
        LEFT JOIN posts AS post
            ON post.category_id = c.id
        """;

    public async Task<IReadOnlyList<CategoryDto>> GetAllAsync(
        CancellationToken cancellationToken)
    {
        var command = new CommandDefinition(
            $"""
            {SelectCategorySql}
            GROUP BY c.id
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
            GROUP BY c.id;
            """,
            new { Id = id },
            cancellationToken: cancellationToken);

        return await db.QuerySingleOrDefaultAsync<CategoryDto>(command);
    }

    public async Task<bool> NameExistsAsync(
        string name,
        int? excludeId,
        CancellationToken cancellationToken)
    {
        const string sql = """
            SELECT EXISTS (
                SELECT 1
                FROM categories
                WHERE lower(name) = lower(@Name)
                    AND (@ExcludeId::int IS NULL OR id <> @ExcludeId)
            );
            """;

        var command = new CommandDefinition(
            sql,
            new { Name = name, ExcludeId = excludeId },
            cancellationToken: cancellationToken);

        return await db.ExecuteScalarAsync<bool>(command);
    }

    public async Task<bool> SlugExistsAsync(
        string slug,
        int? excludeId,
        CancellationToken cancellationToken)
    {
        const string sql = """
            SELECT EXISTS (
                SELECT 1
                FROM categories
                WHERE slug = @Slug
                    AND (@ExcludeId::int IS NULL OR id <> @ExcludeId)
            );
            """;

        var command = new CommandDefinition(
            sql,
            new { Slug = slug, ExcludeId = excludeId },
            cancellationToken: cancellationToken);

        return await db.ExecuteScalarAsync<bool>(command);
    }

    public async Task<CategoryDto> CreateAsync(
        string name,
        string slug,
        string? description,
        CancellationToken cancellationToken)
    {
        const string sql = """
            INSERT INTO categories (
                name,
                slug,
                description
            )
            VALUES (
                @Name,
                @Slug,
                @Description
            )
            RETURNING id;
            """;

        var command = new CommandDefinition(
            sql,
            new
            {
                Name = name,
                Slug = slug,
                Description = description
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
        CancellationToken cancellationToken)
    {
        const string sql = """
            UPDATE categories
            SET
                name = @Name,
                slug = @Slug,
                description = @Description,
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
                Description = description
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
