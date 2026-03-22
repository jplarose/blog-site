using BlogSite.Api.Data;
using BlogSite.Api.DTOs;
using BlogSite.Api.Models;
using BlogSite.Api.Results;
using BlogSite.Api.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace BlogSite.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class PostsController(
    BlogDbContext db,
    PostService postService) : ControllerBase
{
    [HttpGet]
    [ProducesResponseType(typeof(IEnumerable<PostSummaryDto>), StatusCodes.Status200OK)]
    public async Task<ActionResult<IEnumerable<PostSummaryDto>>> GetPosts(
        [FromQuery] string? status,
        [FromQuery] int? categoryId,
        [FromQuery] string? tag,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20)
    {
        var query = db.Posts
            .Include(p => p.Category)
            .Include(p => p.Template)
            .Include(p => p.PostTags).ThenInclude(pt => pt.Tag)
            .AsQueryable();

        if (!string.IsNullOrEmpty(status) && Enum.TryParse<PostStatus>(status, true, out var parsedStatus))
            query = query.Where(p => p.Status == parsedStatus);

        if (categoryId.HasValue)
            query = query.Where(p => p.CategoryId == categoryId);

        if (!string.IsNullOrEmpty(tag))
            query = query.Where(p => p.PostTags.Any(pt => pt.Tag.Slug == tag));

        var total = await query.CountAsync();
        Response.Headers.Append("X-Total-Count", total.ToString());

        var posts = await query
            .OrderByDescending(p => p.PublishedAt ?? p.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync();

        return Ok(posts.Select(ToSummaryDto));
    }

    [HttpGet("{id:int}")]
    [ProducesResponseType(typeof(PostDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<PostDto>> GetPost(int id, CancellationToken cancellationToken)
    {
        var post = await db.Posts
            .Include(p => p.Category)
            .Include(p => p.Template)
            .Include(p => p.PostTags).ThenInclude(pt => pt.Tag)
            .FirstOrDefaultAsync(p => p.Id == id, cancellationToken);

        return post is null ? NotFound() : Ok(ToDto(post));
    }

    [HttpGet("slug/{slug}")]
    [ProducesResponseType(typeof(PostDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<PostDto>> GetPostBySlug(string slug, CancellationToken cancellationToken)
    {
        var post = await db.Posts
            .Include(p => p.Category)
            .Include(p => p.Template)
            .Include(p => p.PostTags).ThenInclude(pt => pt.Tag)
            .FirstOrDefaultAsync(p => p.Slug == slug, cancellationToken);

        return post is null ? NotFound() : Ok(ToDto(post));
    }

    [HttpPost]
    [ProducesResponseType(typeof(PostDto), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<ActionResult<PostDto>> CreatePost(
        [FromBody] CreatePostRequest request,
        CancellationToken cancellationToken)
    {
        var result = await postService.CreateAsync(request, cancellationToken);
        if (result.IsFailure)
        {
            return MapFailure<PostDto>(result);
        }

        var (post, templateContent) = result.Value!;
        return CreatedAtAction(nameof(GetPost), new { id = post.Id }, ToDto(post, templateContent));
    }

    [HttpPut("{id:int}")]
    [ProducesResponseType(typeof(PostDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<ActionResult<PostDto>> UpdatePost(
        int id,
        [FromBody] UpdatePostRequest request,
        CancellationToken cancellationToken)
    {
        var result = await postService.UpdateAsync(id, request, cancellationToken);
        if (result.IsFailure)
        {
            return MapFailure<PostDto>(result);
        }

        var (post, templateContent) = result.Value!;
        return Ok(ToDto(post, templateContent));
    }

    [HttpDelete("{id:int}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> DeletePost(int id, CancellationToken cancellationToken)
    {
        var result = await postService.DeleteAsync(id, cancellationToken);
        if (result.IsFailure)
        {
            return MapFailure(result);
        }

        return NoContent();
    }

    [HttpPost("{id:int}/publish")]
    [ProducesResponseType(typeof(PostDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<PostDto>> PublishPost(int id, CancellationToken cancellationToken)
    {
        var result = await postService.PublishAsync(id, cancellationToken);
        if (result.IsFailure)
        {
            return MapFailure<PostDto>(result);
        }

        return Ok(ToDto(result.Value!));
    }

    private PostDto ToDto(Post p, PostTemplateContentDto? templateContent = null) => new(
        p.Id, p.Title, p.Slug, p.Content, p.Excerpt, p.FeaturedImageUrl,
        p.Status.ToString(), p.PublishedAt, p.ScheduledAt,
        p.CategoryId, p.Category?.Name, p.TemplateId, p.Template?.Name,
        templateContent ?? TemplateJsonSerializer.DeserializeTemplateContent(p.TemplateContentJson),
        p.PostTags.Select(pt => pt.Tag.Name),
        p.CreatedAt, p.UpdatedAt
    );

    private static PostSummaryDto ToSummaryDto(Post p) => new(
        p.Id, p.Title, p.Slug, p.Excerpt, p.FeaturedImageUrl,
        p.Status.ToString(), p.PublishedAt, p.ScheduledAt,
        p.CategoryId, p.Category?.Name, p.TemplateId, p.Template?.Name,
        p.PostTags.Select(pt => pt.Tag.Name),
        p.CreatedAt, p.UpdatedAt
    );

    private ActionResult<T> MapFailure<T>(Result result) =>
        result.Error?.Code switch
        {
            "post.not_found" => NotFound(result.Error.Message),
            "post.invalid_status" => BadRequest(result.Error.Message),
            _ => BadRequest(result.Error?.Message ?? "The request could not be completed.")
        };

    private IActionResult MapFailure(Result result) =>
        result.Error?.Code switch
        {
            "post.not_found" => NotFound(result.Error.Message),
            _ => BadRequest(result.Error?.Message ?? "The request could not be completed.")
        };
}
