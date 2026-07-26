using BlogSite.Api.DTOs;
using Dapper;
using System.Data;

namespace BlogSite.Api.Repositories;

public interface ITagRepository
{
    Task<IReadOnlyList<TagDto>> GetAllAsync(CancellationToken cancellationToken);
    Task<TagDto?> GetByIdAsync(int id, CancellationToken cancellationToken);
    Task<bool> NameExistsAsync(
        string name,
        int? excludeId,
        CancellationToken cancellationToken);
    Task<bool> SlugExistsAsync(
        string slug,
        int? excludeId,
        CancellationToken cancellationToken);
    Task<TagDto> CreateAsync(
        string name,
        string slug,
        CancellationToken cancellationToken);
    Task<TagDto?> UpdateAsync(
        int id,
        string name,
        string slug,
        CancellationToken cancellationToken);
    Task<bool> DeleteAsync(int id, CancellationToken cancellationToken);

    /// <summary>
    /// Returns the subset of <paramref name="ids"/> that correspond to
    /// existing tags, so callers (post writes) can identify any unknown ids
    /// without upserting new tags on their behalf.
    /// </summary>
    Task<IReadOnlyList<int>> GetExistingIdsAsync(
        IReadOnlyList<int> ids,
        CancellationToken cancellationToken);
}

public sealed class TagRepository(IDbConnection db) : ITagRepository
{
    private const string SelectTagSql = """
        SELECT
            tag.id AS Id,
            tag.name AS Name,
            tag.slug AS Slug,
            COUNT(post_tag.post_id)::int AS PostCount,
            tag.created_at AS CreatedAt
        FROM tags AS tag
        LEFT JOIN post_tags AS post_tag
            ON post_tag.tag_id = tag.id
        """;

    public async Task<IReadOnlyList<TagDto>> GetAllAsync(
        CancellationToken cancellationToken)
    {
        var command = new CommandDefinition(
            $"""
            {SelectTagSql}
            GROUP BY tag.id
            ORDER BY tag.name;
            """,
            cancellationToken: cancellationToken);

        var tags = await db.QueryAsync<TagDto>(command);
        return tags.AsList();
    }

    public async Task<TagDto?> GetByIdAsync(
        int id,
        CancellationToken cancellationToken)
    {
        var command = new CommandDefinition(
            $"""
            {SelectTagSql}
            WHERE tag.id = @Id
            GROUP BY tag.id;
            """,
            new { Id = id },
            cancellationToken: cancellationToken);

        return await db.QuerySingleOrDefaultAsync<TagDto>(command);
    }

    public async Task<bool> NameExistsAsync(
        string name,
        int? excludeId,
        CancellationToken cancellationToken)
    {
        const string sql = """
            SELECT EXISTS (
                SELECT 1
                FROM tags
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
                FROM tags
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

    public async Task<TagDto> CreateAsync(
        string name,
        string slug,
        CancellationToken cancellationToken)
    {
        const string sql = """
            INSERT INTO tags (
                name,
                slug
            )
            VALUES (
                @Name,
                @Slug
            )
            RETURNING id;
            """;

        var command = new CommandDefinition(
            sql,
            new { Name = name, Slug = slug },
            cancellationToken: cancellationToken);

        var id = await db.QuerySingleAsync<int>(command);
        return (await GetByIdAsync(id, cancellationToken))!;
    }

    public async Task<TagDto?> UpdateAsync(
        int id,
        string name,
        string slug,
        CancellationToken cancellationToken)
    {
        const string sql = """
            UPDATE tags
            SET
                name = @Name,
                slug = @Slug
            WHERE id = @Id;
            """;

        var command = new CommandDefinition(
            sql,
            new { Id = id, Name = name, Slug = slug },
            cancellationToken: cancellationToken);

        var updated = await db.ExecuteAsync(command);
        return updated == 0 ? null : await GetByIdAsync(id, cancellationToken);
    }

    public async Task<bool> DeleteAsync(int id, CancellationToken cancellationToken)
    {
        const string sql = """
            DELETE FROM tags
            WHERE id = @Id;
            """;

        var command = new CommandDefinition(
            sql,
            new { Id = id },
            cancellationToken: cancellationToken);

        return await db.ExecuteAsync(command) > 0;
    }

    public async Task<IReadOnlyList<int>> GetExistingIdsAsync(
        IReadOnlyList<int> ids,
        CancellationToken cancellationToken)
    {
        if (ids.Count == 0)
        {
            return [];
        }

        const string sql = """
            SELECT id
            FROM tags
            WHERE id = ANY(@Ids);
            """;

        var command = new CommandDefinition(
            sql,
            new { Ids = ids.ToArray() },
            cancellationToken: cancellationToken);

        var existingIds = await db.QueryAsync<int>(command);
        return existingIds.AsList();
    }
}
