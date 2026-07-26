using BlogSite.Api.Common;
using BlogSite.Api.Extensions;
using BlogSite.Api.Repositories;
using BlogSite.Api.Services;

var builder = WebApplication.CreateBuilder(args);

// Database
builder.Services.AddPostgres(builder.Configuration);
builder.Services.AddImageStorage(builder.Configuration);
builder.Services.AddAuthApiJwt(builder.Configuration);
builder.Services.AddScoped<IAnalyticsRepository, AnalyticsRepository>();
builder.Services.AddScoped<ICategoryRepository, CategoryRepository>();
builder.Services.AddScoped<ILayoutTemplateRepository, LayoutTemplateRepository>();
builder.Services.AddScoped<IPostRepository, PostRepository>();
builder.Services.AddScoped<ITagRepository, TagRepository>();
builder.Services.AddSingleton<IPostHtmlSanitizer, PostHtmlSanitizer>();
builder.Services.AddScoped<CategoryService>();
builder.Services.AddScoped<PostService>();
builder.Services.AddScoped<TagService>();

// Controllers & OpenAPI
builder.Services.AddControllers();
builder.Services.AddOpenApi();

// CORS — allow both front-end apps in development
builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
        policy.WithOrigins(
                builder.Configuration.GetSection("AllowedOrigins").Get<string[]>()
                ?? ["http://localhost:3000", "http://localhost:3001"])
            .AllowAnyHeader()
            .AllowAnyMethod());
});

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.UseCors();
app.UseHttpsRedirection();
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();

app.Run();

/// <summary>
/// Entry point marker exposed so integration tests can host the API via
/// <c>WebApplicationFactory&lt;Program&gt;</c>.
/// </summary>
public partial class Program;
