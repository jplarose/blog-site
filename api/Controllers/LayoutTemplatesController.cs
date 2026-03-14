using BlogSite.Api.Data;
using BlogSite.Api.DTOs;
using BlogSite.Api.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace BlogSite.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class LayoutTemplatesController(BlogDbContext db) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<IEnumerable<LayoutTemplateDto>>> GetTemplates()
    {
        var templates = await db.LayoutTemplates
            .OrderBy(t => t.Name)
            .ToListAsync();

        return Ok(templates.Select(ToDto));
    }

    [HttpGet("{id:int}")]
    public async Task<ActionResult<LayoutTemplateDto>> GetTemplate(int id)
    {
        var template = await db.LayoutTemplates.FindAsync(id);
        return template is null ? NotFound() : Ok(ToDto(template));
    }

    [HttpPost]
    public async Task<ActionResult<LayoutTemplateDto>> CreateTemplate([FromBody] CreateLayoutTemplateRequest request)
    {
        if (request.IsDefault)
        {
            var existing = await db.LayoutTemplates.Where(t => t.IsDefault).ToListAsync();
            foreach (var t in existing) t.IsDefault = false;
        }

        var template = new LayoutTemplate
        {
            Name = request.Name,
            Description = request.Description,
            HtmlStructure = request.HtmlStructure,
            CssStyles = request.CssStyles,
            IsDefault = request.IsDefault
        };

        db.LayoutTemplates.Add(template);
        await db.SaveChangesAsync();

        return CreatedAtAction(nameof(GetTemplate), new { id = template.Id }, ToDto(template));
    }

    [HttpPut("{id:int}")]
    public async Task<ActionResult<LayoutTemplateDto>> UpdateTemplate(int id, [FromBody] UpdateLayoutTemplateRequest request)
    {
        var template = await db.LayoutTemplates.FindAsync(id);
        if (template is null) return NotFound();

        if (request.IsDefault && !template.IsDefault)
        {
            var existing = await db.LayoutTemplates.Where(t => t.IsDefault && t.Id != id).ToListAsync();
            foreach (var t in existing) t.IsDefault = false;
        }

        template.Name = request.Name;
        template.Description = request.Description;
        template.HtmlStructure = request.HtmlStructure;
        template.CssStyles = request.CssStyles;
        template.IsDefault = request.IsDefault;
        template.UpdatedAt = DateTime.UtcNow;

        await db.SaveChangesAsync();
        return Ok(ToDto(template));
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> DeleteTemplate(int id)
    {
        var template = await db.LayoutTemplates.FindAsync(id);
        if (template is null) return NotFound();
        db.LayoutTemplates.Remove(template);
        await db.SaveChangesAsync();
        return NoContent();
    }

    private static LayoutTemplateDto ToDto(LayoutTemplate t) => new(
        t.Id, t.Name, t.Description, t.HtmlStructure, t.CssStyles,
        t.IsDefault, t.CreatedAt, t.UpdatedAt
    );
}
