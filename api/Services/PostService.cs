using BlogSite.Api.Common;
using BlogSite.Api.DTOs;
using BlogSite.Api.Domain;
using BlogSite.Api.Repositories;
using BlogSite.Api.Results;

namespace BlogSite.Api.Services;

public class PostService(
    IPostRepository posts,
    ILayoutTemplateRepository templates,
    ITagRepository tags,
    IPostHtmlSanitizer sanitizer)
{
    /// <summary>
    /// Gets a filtered, paginated list of posts. When
    /// <paramref name="includeUnpublished"/> is <c>false</c> (anonymous
    /// caller), the query is forced to Published-only regardless of any
    /// requested status filter — the identity check itself lives in the
    /// controller; this method only receives the resulting boolean, never
    /// <c>HttpContext</c>.
    /// </summary>
    public Task<PostPage> GetAllAsync(
        PostListQuery query,
        bool includeUnpublished,
        CancellationToken cancellationToken)
    {
        var effectiveQuery = includeUnpublished ? query : query with { PublishedOnly = true };
        return posts.GetAllAsync(effectiveQuery, cancellationToken);
    }

    /// <summary>
    /// Gets a post by identifier. When <paramref name="includeUnpublished"/>
    /// is <c>false</c> (anonymous caller), a non-Published post is treated
    /// as not found (returns <c>null</c>) so the controller 404s without
    /// leaking its existence.
    /// </summary>
    public Task<PostDto?> GetByIdAsync(
        int id,
        bool includeUnpublished,
        CancellationToken cancellationToken) =>
        posts.GetByIdAsync(id, publishedOnly: !includeUnpublished, cancellationToken);

    /// <summary>
    /// Gets a post by slug. When <paramref name="includeUnpublished"/> is
    /// <c>false</c> (anonymous caller), a non-Published post is treated as
    /// not found (returns <c>null</c>) so the controller 404s without
    /// leaking its existence.
    /// </summary>
    public Task<PostDto?> GetBySlugAsync(
        string slug,
        bool includeUnpublished,
        CancellationToken cancellationToken) =>
        posts.GetBySlugAsync(slug, publishedOnly: !includeUnpublished, cancellationToken);

    public async Task<Result<PostDto>> CreateAsync(
        CreatePostRequest request,
        CancellationToken cancellationToken)
    {
        if (!Enum.TryParse<PostStatus>(request.Status, true, out var status))
        {
            return Result<PostDto>.Failure(
                "post.invalid_status",
                "Invalid status value.");
        }

        var templateValidation = await ValidateTemplateAsync(
            request.TemplateId,
            cancellationToken);
        if (templateValidation is not null)
        {
            return templateValidation;
        }

        var tagValidation = await ValidateTagIdsAsync(request.TagIds, cancellationToken);
        if (tagValidation is not null)
        {
            return tagValidation;
        }

        var post = await posts.CreateAsync(
            ToPostWrite(request, status),
            cancellationToken);

        return Result<PostDto>.Success(post);
    }

    public async Task<Result<PostDto>> UpdateAsync(
        int id,
        UpdatePostRequest request,
        CancellationToken cancellationToken)
    {
        if (!Enum.TryParse<PostStatus>(request.Status, true, out var status))
        {
            return Result<PostDto>.Failure(
                "post.invalid_status",
                "Invalid status value.");
        }

        var templateValidation = await ValidateTemplateAsync(
            request.TemplateId,
            cancellationToken);
        if (templateValidation is not null)
        {
            return templateValidation;
        }

        var tagValidation = await ValidateTagIdsAsync(request.TagIds, cancellationToken);
        if (tagValidation is not null)
        {
            return tagValidation;
        }

        var post = await posts.UpdateAsync(
            id,
            ToPostWrite(request, status),
            cancellationToken);

        return post is null
            ? Result<PostDto>.Failure("post.not_found", "Post was not found.")
            : Result<PostDto>.Success(post);
    }

    public async Task<Result> DeleteAsync(
        int id,
        CancellationToken cancellationToken)
    {
        var deleted = await posts.DeleteAsync(id, cancellationToken);
        return deleted
            ? Result.Success()
            : Result.Failure("post.not_found", "Post was not found.");
    }

    public async Task<Result<PostDto>> PublishAsync(
        int id,
        CancellationToken cancellationToken)
    {
        var post = await posts.PublishAsync(id, cancellationToken);
        return post is null
            ? Result<PostDto>.Failure("post.not_found", "Post was not found.")
            : Result<PostDto>.Success(post);
    }

    /// <summary>
    /// Schedules a post to go live at a future time. There is no background
    /// scheduler in this system: a Scheduled post only becomes Published
    /// (and publicly visible) via an explicit call to
    /// <see cref="PublishAsync"/> after the scheduled time has passed.
    /// </summary>
    public async Task<Result<PostDto>> ScheduleAsync(
        int id,
        ScheduleRequest request,
        CancellationToken cancellationToken)
    {
        if (request.ScheduledAt is null)
        {
            return Result<PostDto>.Failure(
                "post.invalid_schedule",
                "ScheduledAt is required.");
        }

        if (request.ScheduledAt.Value <= DateTimeOffset.UtcNow)
        {
            return Result<PostDto>.Failure(
                "post.invalid_schedule",
                "ScheduledAt must be in the future.");
        }

        var scheduled = await posts.ScheduleAsync(
            id,
            request.ScheduledAt.Value.UtcDateTime,
            cancellationToken);
        if (scheduled is not null)
        {
            return Result<PostDto>.Success(scheduled);
        }

        // The row may have been deleted or transitioned between the failed
        // update above and this existence check (TOCTOU). That race is
        // accepted as benign here: worst case is a misleading error code
        // (not_found vs invalid_transition) with no data-integrity impact,
        // so no locking/retry is implemented by design.
        var exists = await posts.ExistsAsync(id, cancellationToken);
        return exists
            ? Result<PostDto>.Failure(
                "post.invalid_transition",
                "Only draft or scheduled posts can be scheduled.")
            : Result<PostDto>.Failure("post.not_found", "Post was not found.");
    }

    /// <summary>
    /// Archives a post. Allowed from any state and idempotent: archiving an
    /// already-Archived post simply returns it unchanged.
    /// </summary>
    public async Task<Result<PostDto>> ArchiveAsync(
        int id,
        CancellationToken cancellationToken)
    {
        var post = await posts.ArchiveAsync(id, cancellationToken);
        return post is null
            ? Result<PostDto>.Failure("post.not_found", "Post was not found.")
            : Result<PostDto>.Success(post);
    }

    /// <summary>
    /// Validates that every requested tag id references an existing,
    /// managed tag. Post writes reference tags by id only — there is no
    /// tag-upsert path reachable from post create/update.
    /// </summary>
    private async Task<Result<PostDto>?> ValidateTagIdsAsync(
        IReadOnlyList<int> tagIds,
        CancellationToken cancellationToken)
    {
        if (tagIds.Count == 0)
        {
            return null;
        }

        var requestedIds = tagIds.Distinct().ToList();
        var existingIds = await tags.GetExistingIdsAsync(requestedIds, cancellationToken);
        var unknownIds = requestedIds.Except(existingIds).ToList();

        if (unknownIds.Count > 0)
        {
            return Result<PostDto>.Failure(
                "post.tag_invalid",
                $"TagIds must reference existing tags. Unknown tag id(s): {string.Join(", ", unknownIds)}.");
        }

        return null;
    }

    private async Task<Result<PostDto>?> ValidateTemplateAsync(
        int? templateId,
        CancellationToken cancellationToken)
    {
        if (templateId is null || !await templates.ExistsAsync(templateId.Value, cancellationToken))
        {
            return Result<PostDto>.Failure(
                "post.template_invalid",
                "TemplateId must reference an existing catalog template.");
        }

        return null;
    }

    private PostWrite ToPostWrite(
        CreatePostRequest request,
        PostStatus status) =>
        new(
            sanitizer.SanitizePlainText(request.Title).Trim(),
            request.Slug.Trim(),
            sanitizer.SanitizeRichHtml(request.Content),
            request.Excerpt is null ? null : sanitizer.SanitizePlainText(request.Excerpt).Trim(),
            request.FeaturedImageUrl,
            status.ToString(),
            request.ScheduledAt,
            request.CategoryId,
            request.TemplateId,
            (request.TagIds ?? []).Distinct().ToList());

    private PostWrite ToPostWrite(
        UpdatePostRequest request,
        PostStatus status) =>
        new(
            sanitizer.SanitizePlainText(request.Title).Trim(),
            request.Slug.Trim(),
            sanitizer.SanitizeRichHtml(request.Content),
            request.Excerpt is null ? null : sanitizer.SanitizePlainText(request.Excerpt).Trim(),
            request.FeaturedImageUrl,
            status.ToString(),
            request.ScheduledAt,
            request.CategoryId,
            request.TemplateId,
            (request.TagIds ?? []).Distinct().ToList());
}
