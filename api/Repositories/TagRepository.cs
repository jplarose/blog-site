using BlogSite.Api.DTOs;
using Dapper;
using System.Data;

namespace BlogSite.Api.Repositories;

public interface ITagRepository
{
    Task<IReadOnlyList<TagDto>> GetAllAsync(CancellationToken cancellationToken);
    Task<TagDto?> GetByIdAsync(int id, CancellationToken cancellationToken);
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
}
