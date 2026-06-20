using BlogSite.Api.DTOs;
using System.Text.Json;

namespace BlogSite.Api.Services;

public static class TemplateJsonSerializer
{
    public static JsonDocument SerializeLayout(JsonElement layout) =>
        JsonDocument.Parse(layout.GetRawText());

    public static JsonElement DeserializeLayout(JsonDocument? storedLayout)
    {
        if (storedLayout is not null)
        {
            return storedLayout.RootElement.Clone();
        }

        return CreateEmptyLayout();
    }

    public static JsonDocument? SerializeTemplateContent(PostTemplateContentDto? templateContent)
    {
        if (templateContent is null)
        {
            return null;
        }

        return JsonDocument.Parse(JsonSerializer.Serialize(templateContent));
    }

    public static PostTemplateContentDto? DeserializeTemplateContent(JsonDocument? storedTemplateContent)
    {
        if (storedTemplateContent is null)
        {
            return null;
        }

        try
        {
            return JsonSerializer.Deserialize<PostTemplateContentDto>(storedTemplateContent.RootElement.GetRawText());
        }
        catch (JsonException)
        {
            return null;
        }
    }

    private static JsonElement CreateEmptyLayout() =>
        JsonSerializer.SerializeToElement(new
        {
            version = 1,
            canvas = new
            {
                width = 960,
                minRowHeight = 120
            },
            rootBlockIds = Array.Empty<string>(),
            blocks = new Dictionary<string, object>()
        });
}
