using BlogSite.Api.Infrastructure;
using BlogSite.Api.Repositories;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;

namespace BlogSite.Api.Tests.Auth;

/// <summary>
/// Hosts the real API pipeline (auth middleware, controllers, attribute
/// routing) in-process, with repositories replaced by in-memory fakes and
/// the Auth API revocation check replaced by a controllable stub, so
/// authentication enforcement can be exercised without a database or a
/// live Auth API.
/// </summary>
internal sealed class AuthTestWebApplicationFactory : WebApplicationFactory<Program>
{
    public FakeJtiValidator JtiValidator { get; } = new();

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Development");

        builder.ConfigureServices(services =>
        {
            services.RemoveAll<IJtiValidator>();
            services.AddSingleton<IJtiValidator>(JtiValidator);

            services.RemoveAll<IPostRepository>();
            services.AddSingleton<IPostRepository>(new FakePostRepository());

            services.RemoveAll<ICategoryRepository>();
            services.AddSingleton<ICategoryRepository>(new FakeCategoryRepository());

            services.RemoveAll<ITagRepository>();
            services.AddSingleton<ITagRepository>(new FakeTagRepository());

            services.RemoveAll<ILayoutTemplateRepository>();
            services.AddSingleton<ILayoutTemplateRepository>(new FakeLayoutTemplateRepository());

            services.RemoveAll<IAnalyticsRepository>();
            services.AddSingleton<IAnalyticsRepository>(new FakeAnalyticsRepository());
        });
    }
}
