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
public class LayoutTemplatesController(
    ILayoutTemplateRepository templates,
    LayoutTemplateService layoutTemplateService) : ControllerBase
{
    /// <summary>Gets all layout templates and their usage counts.</summary>
    /// <param name="cancellationToken">Cancels the database operation.</param>
    [HttpGet]
    [AllowAnonymous]
    [ProducesResponseType(
        typeof(IEnumerable<LayoutTemplateSummaryDto>),
        StatusCodes.Status200OK)]
    public async Task<ActionResult<IEnumerable<LayoutTemplateSummaryDto>>> GetTemplates(
        CancellationToken cancellationToken) =>
        Ok(await templates.GetAllAsync(cancellationToken));

    /// <summary>Gets a layout template by identifier.</summary>
    /// <param name="id">Template identifier.</param>
    /// <param name="cancellationToken">Cancels the database operation.</param>
    [HttpGet("{id:int}")]
    [AllowAnonymous]
    [ProducesResponseType(typeof(LayoutTemplateDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<LayoutTemplateDto>> GetTemplate(
        int id,
        CancellationToken cancellationToken)
    {
        var template = await templates.GetByIdAsync(id, cancellationToken);
        return template is null ? NotFound() : Ok(template);
    }

    /// <summary>Creates a layout template.</summary>
    /// <param name="request">Template values.</param>
    /// <param name="cancellationToken">Cancels the database operation.</param>
    [HttpPost]
    [ProducesResponseType(typeof(LayoutTemplateDto), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<ActionResult<LayoutTemplateDto>> CreateTemplate(
        [FromBody] CreateLayoutTemplateRequest request,
        CancellationToken cancellationToken)
    {
        var result = await layoutTemplateService.CreateAsync(request, cancellationToken);
        return result.IsFailure
            ? MapFailure<LayoutTemplateDto>(result)
            : CreatedAtAction(
                nameof(GetTemplate),
                new { id = result.Value!.Id },
                result.Value);
    }

    /// <summary>Updates a layout template.</summary>
    /// <param name="id">Template identifier.</param>
    /// <param name="request">Updated template values.</param>
    /// <param name="cancellationToken">Cancels the database operation.</param>
    [HttpPut("{id:int}")]
    [ProducesResponseType(typeof(LayoutTemplateDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<ActionResult<LayoutTemplateDto>> UpdateTemplate(
        int id,
        [FromBody] UpdateLayoutTemplateRequest request,
        CancellationToken cancellationToken)
    {
        var result = await layoutTemplateService.UpdateAsync(id, request, cancellationToken);
        return result.IsFailure
            ? MapFailure<LayoutTemplateDto>(result)
            : Ok(result.Value);
    }

    /// <summary>Deletes a layout template.</summary>
    /// <param name="id">Template identifier.</param>
    /// <param name="cancellationToken">Cancels the database operation.</param>
    [HttpDelete("{id:int}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> DeleteTemplate(
        int id,
        CancellationToken cancellationToken)
    {
        var result = await layoutTemplateService.DeleteAsync(id, cancellationToken);
        return result.IsFailure ? MapFailure(result) : NoContent();
    }

    private ActionResult<T> MapFailure<T>(Result result) =>
        result.Error?.Code switch
        {
            "template.not_found" => NotFound(result.Error.Message),
            "template.name_required" => BadRequest(result.Error.Message),
            _ => BadRequest(result.Error?.Message ?? "The request could not be completed.")
        };

    private IActionResult MapFailure(Result result) =>
        result.Error?.Code switch
        {
            "template.not_found" => NotFound(result.Error.Message),
            _ => BadRequest(result.Error?.Message ?? "The request could not be completed.")
        };
}
