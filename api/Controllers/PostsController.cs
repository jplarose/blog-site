using BlogSite.Api.Data;
using BlogSite.Api.DTOs;
using BlogSite.Api.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace BlogSite.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class PostsController(BlogDbContext db) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<IEnumerable<PostSummaryDto>>> GetPosts(
        [FromQuery] string? status,
        [FromQuery] int? categoryId,
        [FromQuery] string? tag,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20)
    {
        var query = db.Posts
            .Include(p => p.Category)
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
    public async Task<ActionResult<PostDto>> GetPost(int id)
    {
        var post = await db.Posts
            .Include(p => p.Category)
            .Include(p => p.Template)
            .Include(p => p.PostTags).ThenInclude(pt => pt.Tag)
            .FirstOrDefaultAsync(p => p.Id == id);

        return post is null ? NotFound() : Ok(ToDto(post));
    }

    [HttpGet("slug/{slug}")]
    public async Task<ActionResult<PostDto>> GetPostBySlug(string slug)
    {
        var post = await db.Posts
            .Include(p => p.Category)
            .Include(p => p.Template)
            .Include(p => p.PostTags).ThenInclude(pt => pt.Tag)
            .FirstOrDefaultAsync(p => p.Slug == slug);

        return post is null ? NotFound() : Ok(ToDto(post));
    }

    [HttpPost]
    public async Task<ActionResult<PostDto>> CreatePost([FromBody] CreatePostRequest request)
    {
        if (!Enum.TryParse<PostStatus>(request.Status, true, out var status))
            return BadRequest("Invalid status value.");

        var post = new Post
        {
            Title = request.Title,
            Slug = request.Slug,
            Content = request.Content,
            Excerpt = request.Excerpt,
            FeaturedImageUrl = request.FeaturedImageUrl,
            Status = status,
            ScheduledAt = request.ScheduledAt,
            CategoryId = request.CategoryId,
            TemplateId = request.TemplateId,
            PublishedAt = status == PostStatus.Published ? DateTime.UtcNow : null
        };

        db.Posts.Add(post);
        await db.SaveChangesAsync();

        foreach (var tagId in request.TagIds)
            db.PostTags.Add(new PostTag { PostId = post.Id, TagId = tagId });

        await db.SaveChangesAsync();

        await db.Entry(post).Reference(p => p.Category).LoadAsync();
        await db.Entry(post).Reference(p => p.Template).LoadAsync();
        await db.Entry(post).Collection(p => p.PostTags).Query()
            .Include(pt => pt.Tag).LoadAsync();

        return CreatedAtAction(nameof(GetPost), new { id = post.Id }, ToDto(post));
    }

    [HttpPut("{id:int}")]
    public async Task<ActionResult<PostDto>> UpdatePost(int id, [FromBody] UpdatePostRequest request)
    {
        var post = await db.Posts
            .Include(p => p.PostTags)
            .FirstOrDefaultAsync(p => p.Id == id);

        if (post is null) return NotFound();

        if (!Enum.TryParse<PostStatus>(request.Status, true, out var status))
            return BadRequest("Invalid status value.");

        post.Title = request.Title;
        post.Slug = request.Slug;
        post.Content = request.Content;
        post.Excerpt = request.Excerpt;
        post.FeaturedImageUrl = request.FeaturedImageUrl;
        post.ScheduledAt = request.ScheduledAt;
        post.CategoryId = request.CategoryId;
        post.TemplateId = request.TemplateId;
        post.UpdatedAt = DateTime.UtcNow;

        if (status == PostStatus.Published && post.Status != PostStatus.Published)
            post.PublishedAt = DateTime.UtcNow;

        post.Status = status;

        db.PostTags.RemoveRange(post.PostTags);
        foreach (var tagId in request.TagIds)
            db.PostTags.Add(new PostTag { PostId = post.Id, TagId = tagId });

        await db.SaveChangesAsync();

        await db.Entry(post).Reference(p => p.Category).LoadAsync();
        await db.Entry(post).Reference(p => p.Template).LoadAsync();
        await db.Entry(post).Collection(p => p.PostTags).Query()
            .Include(pt => pt.Tag).LoadAsync();

        return Ok(ToDto(post));
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> DeletePost(int id)
    {
        var post = await db.Posts.FindAsync(id);
        if (post is null) return NotFound();
        db.Posts.Remove(post);
        await db.SaveChangesAsync();
        return NoContent();
    }

    [HttpPost("{id:int}/publish")]
    public async Task<ActionResult<PostDto>> PublishPost(int id)
    {
        var post = await db.Posts
            .Include(p => p.Category)
            .Include(p => p.Template)
            .Include(p => p.PostTags).ThenInclude(pt => pt.Tag)
            .FirstOrDefaultAsync(p => p.Id == id);

        if (post is null) return NotFound();

        post.Status = PostStatus.Published;
        post.PublishedAt = DateTime.UtcNow;
        post.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync();

        return Ok(ToDto(post));
    }

    private static PostDto ToDto(Post p) => new(
        p.Id, p.Title, p.Slug, p.Content, p.Excerpt, p.FeaturedImageUrl,
        p.Status.ToString(), p.PublishedAt, p.ScheduledAt,
        p.CategoryId, p.Category?.Name, p.TemplateId, p.Template?.Name,
        p.PostTags.Select(pt => pt.Tag.Name),
        p.CreatedAt, p.UpdatedAt
    );

    private static PostSummaryDto ToSummaryDto(Post p) => new(
        p.Id, p.Title, p.Slug, p.Excerpt, p.FeaturedImageUrl,
        p.Status.ToString(), p.PublishedAt, p.ScheduledAt,
        p.CategoryId, p.Category?.Name,
        p.PostTags.Select(pt => pt.Tag.Name),
        p.CreatedAt, p.UpdatedAt
    );
}
