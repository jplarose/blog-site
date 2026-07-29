using BlogSite.Api.DTOs;
using BlogSite.Api.Domain;
using BlogSite.Api.Repositories;
using BlogSite.Api.Results;
using BlogSite.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace BlogSite.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class PostsController(PostService postService) : ControllerBase
{
    /// <summary>
    /// Gets a filtered, paginated list of posts.
    /// </summary>
    /// <remarks>
    /// Shared route, identity-branched view: an authenticated admin caller
    /// gets the full behavior described below (all statuses, status filter
    /// honored). An anonymous caller always gets the Published-only view —
    /// any requested <paramref name="status"/> filter is ignored/overridden
    /// to Published so non-Published posts can never be listed publicly.
    /// </remarks>
    /// <param name="status">Optional post status filter.</param>
    /// <param name="categoryId">Optional category identifier filter.</param>
    /// <param name="tag">Optional tag slug filter.</param>
    /// <param name="page">One-based page number.</param>
    /// <param name="pageSize">Maximum posts returned per page.</param>
    /// <param name="cancellationToken">Cancels the database operation.</param>
    [HttpGet]
    [AllowAnonymous]
    [ProducesResponseType(typeof(IEnumerable<PostSummaryDto>), StatusCodes.Status200OK)]
    public async Task<ActionResult<IEnumerable<PostSummaryDto>>> GetPosts(
        [FromQuery] string? status,
        [FromQuery] int? categoryId,
        [FromQuery] string? tag,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        CancellationToken cancellationToken = default)
    {
        string? parsedStatus = null;
        if (!string.IsNullOrWhiteSpace(status)
            && Enum.TryParse<PostStatus>(status, true, out var postStatus))
        {
            parsedStatus = postStatus.ToString();
        }

        var includeUnpublished = User.Identity?.IsAuthenticated == true;
        var result = await postService.GetAllAsync(
            new PostListQuery(parsedStatus, categoryId, tag, page, pageSize),
            includeUnpublished,
            cancellationToken);

        Response.Headers.Append("X-Total-Count", result.TotalCount.ToString());
        return Ok(result.Posts);
    }

    /// <summary>
    /// Gets a post by identifier.
    /// </summary>
    /// <remarks>
    /// Shared route, identity-branched view: an authenticated admin caller
    /// can fetch a post in any state. An anonymous caller only ever sees
    /// Published posts — a Draft, Scheduled, or Archived post 404s (not
    /// 403) for an anonymous caller so its existence is never leaked.
    /// </remarks>
    /// <param name="id">Post identifier.</param>
    /// <param name="cancellationToken">Cancels the database operation.</param>
    [HttpGet("{id:int}")]
    [AllowAnonymous]
    [ProducesResponseType(typeof(PostDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<PostDto>> GetPost(
        int id,
        CancellationToken cancellationToken)
    {
        var includeUnpublished = User.Identity?.IsAuthenticated == true;
        var post = await postService.GetByIdAsync(id, includeUnpublished, cancellationToken);
        return post is null ? NotFound() : Ok(post);
    }

    /// <summary>
    /// Gets a post by slug.
    /// </summary>
    /// <remarks>
    /// Shared route, identity-branched view: an authenticated admin caller
    /// can fetch a post in any state. An anonymous caller only ever sees
    /// Published posts — a Draft, Scheduled, or Archived post 404s (not
    /// 403) for an anonymous caller so its existence is never leaked.
    /// </remarks>
    /// <param name="slug">Post slug.</param>
    /// <param name="cancellationToken">Cancels the database operation.</param>
    [HttpGet("slug/{slug}")]
    [AllowAnonymous]
    [ProducesResponseType(typeof(PostDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<PostDto>> GetPostBySlug(
        string slug,
        CancellationToken cancellationToken)
    {
        var includeUnpublished = User.Identity?.IsAuthenticated == true;
        var post = await postService.GetBySlugAsync(slug, includeUnpublished, cancellationToken);
        return post is null ? NotFound() : Ok(post);
    }

    /// <summary>Creates a post and associates its tags.</summary>
    /// <param name="request">Post values.</param>
    /// <param name="cancellationToken">Cancels the database operation.</param>
    [HttpPost]
    [ProducesResponseType(typeof(PostDto), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<ActionResult<PostDto>> CreatePost(
        [FromBody] CreatePostRequest request,
        CancellationToken cancellationToken)
    {
        var result = await postService.CreateAsync(request, cancellationToken);
        return result.IsFailure
            ? MapFailure<PostDto>(result)
            : CreatedAtAction(
                nameof(GetPost),
                new { id = result.Value!.Id },
                result.Value);
    }

    /// <summary>Updates a post and replaces its tag associations.</summary>
    /// <param name="id">Post identifier.</param>
    /// <param name="request">Updated post values.</param>
    /// <param name="cancellationToken">Cancels the database operation.</param>
    [HttpPut("{id:int}")]
    [ProducesResponseType(typeof(PostDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<ActionResult<PostDto>> UpdatePost(
        int id,
        [FromBody] UpdatePostRequest request,
        CancellationToken cancellationToken)
    {
        var result = await postService.UpdateAsync(id, request, cancellationToken);
        return result.IsFailure
            ? MapFailure<PostDto>(result)
            : Ok(result.Value);
    }

    /// <summary>Deletes a post.</summary>
    /// <param name="id">Post identifier.</param>
    /// <param name="cancellationToken">Cancels the database operation.</param>
    [HttpDelete("{id:int}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> DeletePost(
        int id,
        CancellationToken cancellationToken)
    {
        var result = await postService.DeleteAsync(id, cancellationToken);
        return result.IsFailure ? MapFailure(result) : NoContent();
    }

    /// <summary>
    /// Publishes a post immediately. Allowed from any state and idempotent:
    /// publishing an already-Published post leaves its original
    /// <c>publishedAt</c> untouched and simply clears any pending schedule.
    /// </summary>
    /// <param name="id">Post identifier.</param>
    /// <param name="cancellationToken">Cancels the database operation.</param>
    [HttpPost("{id:int}/publish")]
    [ProducesResponseType(typeof(PostDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<PostDto>> PublishPost(
        int id,
        CancellationToken cancellationToken)
    {
        var result = await postService.PublishAsync(id, cancellationToken);
        return result.IsFailure
            ? MapFailure<PostDto>(result)
            : Ok(result.Value);
    }

    /// <summary>
    /// Schedules a post to go live at a future time. There is no background
    /// scheduler: a Scheduled post only becomes publicly visible once this
    /// system's owner explicitly calls <see cref="PublishPost"/> after the
    /// scheduled time — scheduling alone never flips a post to Published.
    /// </summary>
    /// <param name="id">Post identifier.</param>
    /// <param name="request">The future date and time the post should go live.</param>
    /// <param name="cancellationToken">Cancels the database operation.</param>
    /// <response code="400">
    /// <c>scheduledAt</c> is missing or is not strictly in the future.
    /// </response>
    /// <response code="409">
    /// The post is Published or Archived; only Draft or Scheduled posts can
    /// be scheduled.
    /// </response>
    [HttpPost("{id:int}/schedule")]
    [ProducesResponseType(typeof(PostDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<ActionResult<PostDto>> SchedulePost(
        int id,
        [FromBody] ScheduleRequest request,
        CancellationToken cancellationToken)
    {
        var result = await postService.ScheduleAsync(id, request, cancellationToken);
        return result.IsFailure
            ? MapFailure<PostDto>(result)
            : Ok(result.Value);
    }

    /// <summary>
    /// Archives a post. Allowed from any state and idempotent: archiving an
    /// already-Archived post returns it unchanged.
    /// </summary>
    /// <param name="id">Post identifier.</param>
    /// <param name="cancellationToken">Cancels the database operation.</param>
    [HttpPost("{id:int}/archive")]
    [ProducesResponseType(typeof(PostDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<PostDto>> ArchivePost(
        int id,
        CancellationToken cancellationToken)
    {
        var result = await postService.ArchiveAsync(id, cancellationToken);
        return result.IsFailure
            ? MapFailure<PostDto>(result)
            : Ok(result.Value);
    }

    private ActionResult<T> MapFailure<T>(Result result) =>
        result.Error?.Code switch
        {
            "post.not_found" => NotFound(result.Error.Message),
            "post.invalid_status" => BadRequest(result.Error.Message),
            "post.slug_required" => BadRequest(result.Error.Message),
            "post.slug_invalid" => BadRequest(result.Error.Message),
            "post.duplicate_slug" => Conflict(result.Error.Message),
            "post.template_invalid" => BadRequest(result.Error.Message),
            "post.tag_invalid" => BadRequest(result.Error.Message),
            "post.invalid_schedule" => BadRequest(result.Error.Message),
            "post.invalid_transition" => Conflict(result.Error.Message),
            _ => BadRequest(result.Error?.Message ?? "The request could not be completed.")
        };

    private IActionResult MapFailure(Result result) =>
        result.Error?.Code switch
        {
            "post.not_found" => NotFound(result.Error.Message),
            _ => BadRequest(result.Error?.Message ?? "The request could not be completed.")
        };
}
