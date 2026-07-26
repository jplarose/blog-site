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
public class PostsController(
    IPostRepository posts,
    PostService postService) : ControllerBase
{
    /// <summary>Gets a filtered, paginated list of posts.</summary>
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

        var result = await posts.GetAllAsync(
            new PostListQuery(parsedStatus, categoryId, tag, page, pageSize),
            cancellationToken);

        Response.Headers.Append("X-Total-Count", result.TotalCount.ToString());
        return Ok(result.Posts);
    }

    /// <summary>Gets a post by identifier.</summary>
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
        var post = await posts.GetByIdAsync(id, cancellationToken);
        return post is null ? NotFound() : Ok(post);
    }

    /// <summary>Gets a post by slug.</summary>
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
        var post = await posts.GetBySlugAsync(slug, cancellationToken);
        return post is null ? NotFound() : Ok(post);
    }

    /// <summary>Creates a post and associates its tags.</summary>
    /// <param name="request">Post values.</param>
    /// <param name="cancellationToken">Cancels the database operation.</param>
    [HttpPost]
    [ProducesResponseType(typeof(PostDto), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
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

    /// <summary>Publishes a post immediately.</summary>
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
