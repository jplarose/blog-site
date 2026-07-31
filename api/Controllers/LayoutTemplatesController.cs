using BlogSite.Api.DTOs;
using BlogSite.Api.Repositories;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace BlogSite.Api.Controllers;

/// <summary>
/// Read-only access to the fixed layout template catalog. The catalog is
/// application-managed and seeded; there is no create, update, or delete
/// action for templates anywhere in this API.
/// </summary>
[ApiController]
[Route("api/[controller]")]
[AllowAnonymous]
public class LayoutTemplatesController(ILayoutTemplateRepository templates) : ControllerBase
{
    /// <summary>Gets every template in the fixed catalog.</summary>
    /// <param name="cancellationToken">Cancels the database operation.</param>
    [HttpGet]
    [ProducesResponseType(
        typeof(IEnumerable<LayoutTemplateSummaryDto>),
        StatusCodes.Status200OK)]
    public async Task<ActionResult<IEnumerable<LayoutTemplateSummaryDto>>> GetTemplates(
        CancellationToken cancellationToken) =>
        Ok(await templates.GetAllAsync(cancellationToken));

    /// <summary>Gets a single catalog template by identifier.</summary>
    /// <param name="id">Template identifier.</param>
    /// <param name="cancellationToken">Cancels the database operation.</param>
    [HttpGet("{id:int}")]
    [ProducesResponseType(typeof(LayoutTemplateDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<LayoutTemplateDto>> GetTemplate(
        int id,
        CancellationToken cancellationToken)
    {
        var template = await templates.GetByIdAsync(id, cancellationToken);
        return template is null ? NotFound() : Ok(template);
    }
}
