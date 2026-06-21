using BlogSite.Api.DTOs;
using Dapper;
using System.Data;
using System.Text.Json;

namespace BlogSite.Api.Repositories;

public sealed record PostListQuery(
    string? Status,
    int? CategoryId,
    string? Tag,
    int Page,
    int PageSize);

public sealed record PostPage(
    IReadOnlyList<PostSummaryDto> Posts,
    int TotalCount);

public sealed record PostTagWrite(string Name, string Slug);

public sealed record PostWrite(
    string Title,
    string Slug,
    string Content,
    string? Excerpt,
    string? FeaturedImageUrl,
    string Status,
    DateTime? ScheduledAt,
    int? CategoryId,
    int? TemplateId,
    PostTemplateContentDto? TemplateContent,
    IReadOnlyList<PostTagWrite> Tags);

public interface IPostRepository
{
    Task<PostPage> GetAllAsync(
        PostListQuery query,
        CancellationToken cancellationToken);
    Task<PostDto?> GetByIdAsync(int id, CancellationToken cancellationToken);
    Task<PostDto?> GetBySlugAsync(string slug, CancellationToken cancellationToken);
    Task<PostDto> CreateAsync(PostWrite post, CancellationToken cancellationToken);
    Task<PostDto?> UpdateAsync(
        int id,
        PostWrite post,
        CancellationToken cancellationToken);
    Task<bool> DeleteAsync(int id, CancellationToken cancellationToken);
    Task<PostDto?> PublishAsync(int id, CancellationToken cancellationToken);
}

public sealed class PostRepository(IDbConnection db) : IPostRepository
{
    private const string SelectPostSql = """
        SELECT
            post.id AS Id,
            post.title AS Title,
            post.slug AS Slug,
            post.content AS Content,
            post.excerpt AS Excerpt,
            post.featured_image_url AS FeaturedImageUrl,
            post.status AS Status,
            post.published_at AS PublishedAt,
            post.scheduled_at AS ScheduledAt,
            post.category_id AS CategoryId,
            category.name AS CategoryName,
            post.template_id AS TemplateId,
            template.name AS TemplateName,
            post.template_content::text AS TemplateContentJson,
            post.created_at AS CreatedAt,
            post.updated_at AS UpdatedAt
        FROM posts AS post
        LEFT JOIN categories AS category
            ON category.id = post.category_id
        LEFT JOIN layout_templates AS template
            ON template.id = post.template_id
        """;

    public async Task<PostPage> GetAllAsync(
        PostListQuery query,
        CancellationToken cancellationToken)
    {
        var predicates = new List<string>();
        var parameters = new DynamicParameters();

        if (!string.IsNullOrWhiteSpace(query.Status))
        {
            predicates.Add("post.status = @Status");
            parameters.Add("Status", query.Status);
        }

        if (query.CategoryId.HasValue)
        {
            predicates.Add("post.category_id = @CategoryId");
            parameters.Add("CategoryId", query.CategoryId.Value);
        }

        if (!string.IsNullOrWhiteSpace(query.Tag))
        {
            predicates.Add(
                """
                EXISTS (
                    SELECT 1
                    FROM post_tags AS filter_post_tag
                    INNER JOIN tags AS filter_tag
                        ON filter_tag.id = filter_post_tag.tag_id
                    WHERE filter_post_tag.post_id = post.id
                        AND filter_tag.slug = @Tag
                )
                """);
            parameters.Add("Tag", query.Tag);
        }

        var whereClause = predicates.Count == 0
            ? string.Empty
            : $"WHERE {string.Join("\n    AND ", predicates)}";

        parameters.Add("Limit", query.PageSize);
        parameters.Add("Offset", (query.Page - 1) * query.PageSize);

        var command = new CommandDefinition(
            $"""
            SELECT COUNT(*)::int
            FROM posts AS post
            {whereClause};

            SELECT
                post.id AS Id,
                post.title AS Title,
                post.slug AS Slug,
                post.excerpt AS Excerpt,
                post.featured_image_url AS FeaturedImageUrl,
                post.status AS Status,
                post.published_at AS PublishedAt,
                post.scheduled_at AS ScheduledAt,
                post.category_id AS CategoryId,
                category.name AS CategoryName,
                post.template_id AS TemplateId,
                template.name AS TemplateName,
                post.created_at AS CreatedAt,
                post.updated_at AS UpdatedAt
            FROM posts AS post
            LEFT JOIN categories AS category
                ON category.id = post.category_id
            LEFT JOIN layout_templates AS template
                ON template.id = post.template_id
            {whereClause}
            ORDER BY COALESCE(post.published_at, post.created_at) DESC
            LIMIT @Limit
            OFFSET @Offset;
            """,
            parameters,
            cancellationToken: cancellationToken);

        int totalCount;
        List<PostSummaryRow> rows;
        using (var result = await db.QueryMultipleAsync(command))
        {
            totalCount = await result.ReadSingleAsync<int>();
            rows = (await result.ReadAsync<PostSummaryRow>()).AsList();
        }

        var tags = await GetTagsByPostIdAsync(
            rows.Select(row => row.Id).ToArray(),
            cancellationToken);

        var posts = rows
            .Select(row => row.ToDto(GetTagNames(tags, row.Id)))
            .ToList();

        return new PostPage(posts, totalCount);
    }

    public Task<PostDto?> GetByIdAsync(
        int id,
        CancellationToken cancellationToken) =>
        GetOneAsync("post.id = @Value", id, cancellationToken);

    public Task<PostDto?> GetBySlugAsync(
        string slug,
        CancellationToken cancellationToken) =>
        GetOneAsync("post.slug = @Value", slug, cancellationToken);

    public async Task<PostDto> CreateAsync(
        PostWrite post,
        CancellationToken cancellationToken)
    {
        await RepositoryConnection.EnsureOpenAsync(db, cancellationToken);
        using var transaction = db.BeginTransaction();

        const string sql = """
            INSERT INTO posts (
                title,
                slug,
                content,
                excerpt,
                featured_image_url,
                status,
                published_at,
                scheduled_at,
                category_id,
                template_id,
                template_content
            )
            VALUES (
                @Title,
                @Slug,
                @Content,
                @Excerpt,
                @FeaturedImageUrl,
                @Status,
                CASE WHEN @Status = 'Published' THEN NOW() ELSE NULL END,
                @ScheduledAt,
                @CategoryId,
                @TemplateId,
                CAST(@TemplateContentJson AS jsonb)
            )
            RETURNING id;
            """;

        var command = new CommandDefinition(
            sql,
            ToParameters(post),
            transaction,
            cancellationToken: cancellationToken);

        var id = await db.QuerySingleAsync<int>(command);
        await ReplaceTagsAsync(id, post.Tags, transaction, cancellationToken);
        transaction.Commit();

        return (await GetByIdAsync(id, cancellationToken))!;
    }

    public async Task<PostDto?> UpdateAsync(
        int id,
        PostWrite post,
        CancellationToken cancellationToken)
    {
        await RepositoryConnection.EnsureOpenAsync(db, cancellationToken);
        using var transaction = db.BeginTransaction();

        const string sql = """
            UPDATE posts
            SET
                title = @Title,
                slug = @Slug,
                content = @Content,
                excerpt = @Excerpt,
                featured_image_url = @FeaturedImageUrl,
                published_at = CASE
                    WHEN @Status = 'Published' AND status <> 'Published' THEN NOW()
                    ELSE published_at
                END,
                status = @Status,
                scheduled_at = @ScheduledAt,
                category_id = @CategoryId,
                template_id = @TemplateId,
                template_content = CAST(@TemplateContentJson AS jsonb),
                updated_at = NOW()
            WHERE id = @Id;
            """;

        var parameters = ToParameters(post);
        parameters.Add("Id", id);

        var command = new CommandDefinition(
            sql,
            parameters,
            transaction,
            cancellationToken: cancellationToken);

        var updated = await db.ExecuteAsync(command);
        if (updated == 0)
        {
            transaction.Rollback();
            return null;
        }

        await ReplaceTagsAsync(id, post.Tags, transaction, cancellationToken);
        transaction.Commit();

        return await GetByIdAsync(id, cancellationToken);
    }

    public async Task<bool> DeleteAsync(int id, CancellationToken cancellationToken)
    {
        const string sql = """
            DELETE FROM posts
            WHERE id = @Id;
            """;

        var command = new CommandDefinition(
            sql,
            new { Id = id },
            cancellationToken: cancellationToken);

        return await db.ExecuteAsync(command) > 0;
    }

    public async Task<PostDto?> PublishAsync(
        int id,
        CancellationToken cancellationToken)
    {
        const string sql = """
            UPDATE posts
            SET
                status = 'Published',
                published_at = NOW(),
                updated_at = NOW()
            WHERE id = @Id;
            """;

        var command = new CommandDefinition(
            sql,
            new { Id = id },
            cancellationToken: cancellationToken);

        var updated = await db.ExecuteAsync(command);
        return updated == 0 ? null : await GetByIdAsync(id, cancellationToken);
    }

    private async Task<PostDto?> GetOneAsync(
        string predicate,
        object value,
        CancellationToken cancellationToken)
    {
        var command = new CommandDefinition(
            $"""
            {SelectPostSql}
            WHERE {predicate};
            """,
            new { Value = value },
            cancellationToken: cancellationToken);

        var row = await db.QuerySingleOrDefaultAsync<PostDetailRow>(command);
        if (row is null)
        {
            return null;
        }

        var tags = await GetTagsByPostIdAsync([row.Id], cancellationToken);
        return row.ToDto(GetTagNames(tags, row.Id));
    }

    private async Task<IReadOnlyList<PostTagRow>> GetTagsByPostIdAsync(
        int[] postIds,
        CancellationToken cancellationToken)
    {
        if (postIds.Length == 0)
        {
            return [];
        }

        const string sql = """
            SELECT
                post_tag.post_id AS PostId,
                tag.name AS Name
            FROM post_tags AS post_tag
            INNER JOIN tags AS tag
                ON tag.id = post_tag.tag_id
            WHERE post_tag.post_id = ANY(@PostIds)
            ORDER BY tag.name;
            """;

        var command = new CommandDefinition(
            sql,
            new { PostIds = postIds },
            cancellationToken: cancellationToken);

        return (await db.QueryAsync<PostTagRow>(command)).AsList();
    }

    private async Task ReplaceTagsAsync(
        int postId,
        IReadOnlyList<PostTagWrite> tags,
        IDbTransaction transaction,
        CancellationToken cancellationToken)
    {
        const string deleteSql = """
            DELETE FROM post_tags
            WHERE post_id = @PostId;
            """;

        await db.ExecuteAsync(new CommandDefinition(
            deleteSql,
            new { PostId = postId },
            transaction,
            cancellationToken: cancellationToken));

        const string resolveTagSql = """
            WITH inserted AS (
                INSERT INTO tags (
                    name,
                    slug
                )
                VALUES (
                    @Name,
                    @Slug
                )
                ON CONFLICT (slug) DO NOTHING
                RETURNING id
            )
            SELECT id
            FROM inserted
            UNION ALL
            SELECT id
            FROM tags
            WHERE slug = @Slug
            LIMIT 1;
            """;

        const string insertPostTagSql = """
            INSERT INTO post_tags (
                post_id,
                tag_id
            )
            VALUES (
                @PostId,
                @TagId
            )
            ON CONFLICT DO NOTHING;
            """;

        foreach (var tag in tags)
        {
            var tagId = await db.QuerySingleAsync<int>(new CommandDefinition(
                resolveTagSql,
                tag,
                transaction,
                cancellationToken: cancellationToken));

            await db.ExecuteAsync(new CommandDefinition(
                insertPostTagSql,
                new { PostId = postId, TagId = tagId },
                transaction,
                cancellationToken: cancellationToken));
        }
    }

    private static DynamicParameters ToParameters(PostWrite post)
    {
        var parameters = new DynamicParameters();
        parameters.Add("Title", post.Title);
        parameters.Add("Slug", post.Slug);
        parameters.Add("Content", post.Content);
        parameters.Add("Excerpt", post.Excerpt);
        parameters.Add("FeaturedImageUrl", post.FeaturedImageUrl);
        parameters.Add("Status", post.Status);
        parameters.Add("ScheduledAt", post.ScheduledAt);
        parameters.Add("CategoryId", post.CategoryId);
        parameters.Add("TemplateId", post.TemplateId);
        parameters.Add(
            "TemplateContentJson",
            post.TemplateContent is null
                ? null
                : JsonSerializer.Serialize(post.TemplateContent));
        return parameters;
    }

    private static IReadOnlyList<string> GetTagNames(
        IReadOnlyList<PostTagRow> tags,
        int postId) =>
        tags
            .Where(tag => tag.PostId == postId)
            .Select(tag => tag.Name)
            .ToList();

    private sealed record PostTagRow(int PostId, string Name);

    private sealed record PostSummaryRow(
        int Id,
        string Title,
        string Slug,
        string? Excerpt,
        string? FeaturedImageUrl,
        string Status,
        DateTime? PublishedAt,
        DateTime? ScheduledAt,
        int? CategoryId,
        string? CategoryName,
        int? TemplateId,
        string? TemplateName,
        DateTime CreatedAt,
        DateTime UpdatedAt)
    {
        public PostSummaryDto ToDto(IReadOnlyList<string> tags) => new(
            Id,
            Title,
            Slug,
            Excerpt,
            FeaturedImageUrl,
            Status,
            PublishedAt,
            ScheduledAt,
            CategoryId,
            CategoryName,
            TemplateId,
            TemplateName,
            tags,
            CreatedAt,
            UpdatedAt);
    }

    private sealed record PostDetailRow(
        int Id,
        string Title,
        string Slug,
        string Content,
        string? Excerpt,
        string? FeaturedImageUrl,
        string Status,
        DateTime? PublishedAt,
        DateTime? ScheduledAt,
        int? CategoryId,
        string? CategoryName,
        int? TemplateId,
        string? TemplateName,
        string? TemplateContentJson,
        DateTime CreatedAt,
        DateTime UpdatedAt)
    {
        public PostDto ToDto(IReadOnlyList<string> tags) => new(
            Id,
            Title,
            Slug,
            Content,
            Excerpt,
            FeaturedImageUrl,
            Status,
            PublishedAt,
            ScheduledAt,
            CategoryId,
            CategoryName,
            TemplateId,
            TemplateName,
            DeserializeTemplateContent(TemplateContentJson),
            tags,
            CreatedAt,
            UpdatedAt);

        private static PostTemplateContentDto? DeserializeTemplateContent(string? json)
        {
            if (string.IsNullOrWhiteSpace(json))
            {
                return null;
            }

            try
            {
                return JsonSerializer.Deserialize<PostTemplateContentDto>(json);
            }
            catch (JsonException)
            {
                return null;
            }
        }
    }
}
