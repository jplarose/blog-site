using BlogSite.Api.DTOs;
using Dapper;
using System.Data;

namespace BlogSite.Api.Repositories;

public interface ITagRepository
{
    /// <param name="publishedOnly">
    /// When <c>true</c> (anonymous caller), <c>PostCount</c> counts only
    /// Published posts so public reads never leak how many non-Published
    /// posts use a tag. When <c>false</c> (admin), all attached posts
    /// count — the referenced-delete protection relies on this.
    /// </param>
    Task<IReadOnlyList<TagDto>> GetAllAsync(
        bool publishedOnly,
        CancellationToken cancellationToken);

    /// <param name="publishedOnly">
    /// When <c>true</c> (anonymous caller), <c>PostCount</c> counts only
    /// Published posts so public reads never leak how many non-Published
    /// posts use a tag. When <c>false</c> (admin), all attached posts
    /// count — the referenced-delete protection relies on this.
    /// </param>
    Task<TagDto?> GetByIdAsync(
        int id,
        bool publishedOnly,
        CancellationToken cancellationToken);
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
            COUNT(post.id)::int AS PostCount,
            tag.created_at AS CreatedAt
        FROM tags AS tag
        LEFT JOIN post_tags AS post_tag
            ON post_tag.tag_id = tag.id
        LEFT JOIN posts AS post
            ON post.id = post_tag.post_id
            AND (@PublishedOnly = FALSE OR post.status = 'Published')
        """;

    public async Task<IReadOnlyList<TagDto>> GetAllAsync(
        bool publishedOnly,
        CancellationToken cancellationToken)
    {
        var command = new CommandDefinition(
            $"""
            {SelectTagSql}
            GROUP BY tag.id
            ORDER BY tag.name;
            """,
            new { PublishedOnly = publishedOnly },
            cancellationToken: cancellationToken);

        var tags = await db.QueryAsync<TagDto>(command);
        return tags.AsList();
    }

    public async Task<TagDto?> GetByIdAsync(
        int id,
        bool publishedOnly,
        CancellationToken cancellationToken)
    {
        var command = new CommandDefinition(
            $"""
            {SelectTagSql}
            WHERE tag.id = @Id
            GROUP BY tag.id;
            """,
            new { Id = id, PublishedOnly = publishedOnly },
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
        return (await GetByIdAsync(id, publishedOnly: false, cancellationToken))!;
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
        return updated == 0 ? null : await GetByIdAsync(id, publishedOnly: false, cancellationToken);
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
