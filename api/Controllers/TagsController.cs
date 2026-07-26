using BlogSite.Api.DTOs;
using BlogSite.Api.Repositories;
using BlogSite.Api.Results;
using BlogSite.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace BlogSite.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class TagsController(
    ITagRepository tags,
    TagService tagService) : ControllerBase
{
    /// <summary>Gets all tags and their post counts.</summary>
    /// <param name="cancellationToken">Cancels the database operation.</param>
    [HttpGet]
    [AllowAnonymous]
    [ProducesResponseType(typeof(IEnumerable<TagDto>), StatusCodes.Status200OK)]
    public async Task<ActionResult<IEnumerable<TagDto>>> GetTags(
        CancellationToken cancellationToken) =>
        Ok(await tags.GetAllAsync(cancellationToken));

    /// <summary>Gets a tag by identifier.</summary>
    /// <param name="id">Tag identifier.</param>
    /// <param name="cancellationToken">Cancels the database operation.</param>
    [HttpGet("{id:int}")]
    [AllowAnonymous]
    [ProducesResponseType(typeof(TagDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<TagDto>> GetTag(
        int id,
        CancellationToken cancellationToken)
    {
        var tag = await tags.GetByIdAsync(id, cancellationToken);
        return tag is null ? NotFound() : Ok(tag);
    }

    /// <summary>Creates a tag.</summary>
    /// <param name="request">Tag values.</param>
    /// <param name="cancellationToken">Cancels the database operation.</param>
    [HttpPost]
    [ProducesResponseType(typeof(TagDto), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<ActionResult<TagDto>> CreateTag(
        [FromBody] CreateTagRequest request,
        CancellationToken cancellationToken)
    {
        var result = await tagService.CreateAsync(request, cancellationToken);
        return result.IsFailure
            ? MapFailure<TagDto>(result)
            : CreatedAtAction(
                nameof(GetTag),
                new { id = result.Value!.Id },
                result.Value);
    }

    /// <summary>Updates a tag.</summary>
    /// <param name="id">Tag identifier.</param>
    /// <param name="request">Updated tag values.</param>
    /// <param name="cancellationToken">Cancels the database operation.</param>
    [HttpPut("{id:int}")]
    [ProducesResponseType(typeof(TagDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<ActionResult<TagDto>> UpdateTag(
        int id,
        [FromBody] UpdateTagRequest request,
        CancellationToken cancellationToken)
    {
        var result = await tagService.UpdateAsync(id, request, cancellationToken);
        return result.IsFailure
            ? MapFailure<TagDto>(result)
            : Ok(result.Value);
    }

    /// <summary>Deletes a tag.</summary>
    /// <param name="id">Tag identifier.</param>
    /// <param name="cancellationToken">Cancels the database operation.</param>
    [HttpDelete("{id:int}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> DeleteTag(
        int id,
        CancellationToken cancellationToken)
    {
        var result = await tagService.DeleteAsync(id, cancellationToken);
        return result.IsFailure ? MapFailure(result) : NoContent();
    }

    private ActionResult<T> MapFailure<T>(Result result) =>
        result.Error?.Code switch
        {
            "tag.not_found" => NotFound(result.Error.Message),
            "tag.name_required" => BadRequest(result.Error.Message),
            "tag.slug_required" => BadRequest(result.Error.Message),
            "tag.slug_invalid" => BadRequest(result.Error.Message),
            "tag.duplicate_name" => Conflict(result.Error.Message),
            "tag.duplicate_slug" => Conflict(result.Error.Message),
            _ => BadRequest(result.Error?.Message ?? "The request could not be completed.")
        };

    private IActionResult MapFailure(Result result) =>
        result.Error?.Code switch
        {
            "tag.not_found" => NotFound(result.Error.Message),
            "tag.referenced" => Conflict(result.Error.Message),
            _ => BadRequest(result.Error?.Message ?? "The request could not be completed.")
        };
}
