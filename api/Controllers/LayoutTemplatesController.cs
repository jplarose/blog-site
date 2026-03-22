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
public class LayoutTemplatesController(
    BlogDbContext db,
    LayoutTemplateService layoutTemplateService) : ControllerBase
{
    [HttpGet]
    [ProducesResponseType(typeof(IEnumerable<LayoutTemplateSummaryDto>), StatusCodes.Status200OK)]
    public async Task<ActionResult<IEnumerable<LayoutTemplateSummaryDto>>> GetTemplates()
    {
        var templates = await db.LayoutTemplates
            .Include(t => t.Categories)
            .Include(t => t.Posts)
            .OrderBy(t => t.Name)
            .ToListAsync();

        return Ok(templates.Select(ToSummaryDto));
    }

    [HttpGet("{id:int}")]
    [ProducesResponseType(typeof(LayoutTemplateDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<LayoutTemplateDto>> GetTemplate(int id, CancellationToken cancellationToken)
    {
        var template = await db.LayoutTemplates.FindAsync([id], cancellationToken);
        return template is null ? NotFound() : Ok(ToDto(template));
    }

    [HttpPost]
    [ProducesResponseType(typeof(LayoutTemplateDto), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<ActionResult<LayoutTemplateDto>> CreateTemplate(
        [FromBody] CreateLayoutTemplateRequest request,
        CancellationToken cancellationToken)
    {
        var result = await layoutTemplateService.CreateAsync(request, cancellationToken);
        if (result.IsFailure)
        {
            return MapFailure<LayoutTemplateDto>(result);
        }

        return CreatedAtAction(nameof(GetTemplate), new { id = result.Value!.Id }, ToDto(result.Value!));
    }

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
        if (result.IsFailure)
        {
            return MapFailure<LayoutTemplateDto>(result);
        }

        return Ok(ToDto(result.Value!));
    }

    [HttpDelete("{id:int}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> DeleteTemplate(int id, CancellationToken cancellationToken)
    {
        var result = await layoutTemplateService.DeleteAsync(id, cancellationToken);
        if (result.IsFailure)
        {
            return MapFailure(result);
        }

        return NoContent();
    }

    private static LayoutTemplateSummaryDto ToSummaryDto(LayoutTemplate t) => new(
        t.Id, t.Name, t.Description,
        t.IsDefault, t.Categories.Count, t.Posts.Count, t.CreatedAt, t.UpdatedAt
    );

    private static LayoutTemplateDto ToDto(LayoutTemplate t) => new(
        t.Id, t.Name, t.Description, TemplateJsonSerializer.DeserializeLayout(t.LayoutJson),
        t.IsDefault, t.CreatedAt, t.UpdatedAt
    );

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
