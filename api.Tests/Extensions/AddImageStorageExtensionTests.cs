using BlogSite.Api.Extensions;
using BlogSite.Api.Options;
using BlogSite.Api.Storage;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;

namespace BlogSite.Api.Tests.Extensions;

public class AddImageStorageExtensionTests
{
    [Fact]
    public void AddImageStorage_CompleteConfiguration_RegistersStoreAndOptions()
    {
        var configuration = BuildConfiguration(new Dictionary<string, string?>
        {
            ["SeaweedFiler:PrivateBaseUrl"] = "http://seaweed-filer:8888",
            ["SeaweedFiler:PublicBaseUrl"] = "https://media.example.test",
            ["SeaweedFiler:PathPrefix"] = "blog/images"
        });
        var services = new ServiceCollection();
        services.AddLogging();

        services.AddImageStorage(configuration);

        using var provider = services.BuildServiceProvider();
        var options = provider.GetRequiredService<IOptions<SeaweedFilerOptions>>().Value;
        var store = provider.GetRequiredService<IImageStore>();

        Assert.Equal("http://seaweed-filer:8888", options.PrivateBaseUrl);
        Assert.Equal("https://media.example.test", options.PublicBaseUrl);
        Assert.Equal("blog/images", options.PathPrefix);
        Assert.IsType<SeaweedFilerImageStore>(store);
    }

    [Fact]
    public void AddImageStorage_MissingPublicBaseUrl_FailsValidation()
    {
        var configuration = BuildConfiguration(new Dictionary<string, string?>
        {
            ["SeaweedFiler:PrivateBaseUrl"] = "http://seaweed-filer:8888"
        });
        var services = new ServiceCollection();
        services.AddLogging();
        services.AddImageStorage(configuration);

        using var provider = services.BuildServiceProvider();

        Assert.Throws<OptionsValidationException>(
            () => provider.GetRequiredService<IOptions<SeaweedFilerOptions>>().Value);
    }

    [Fact]
    public void AddImageStorage_InvalidPathPrefix_FailsValidation()
    {
        var configuration = BuildConfiguration(new Dictionary<string, string?>
        {
            ["SeaweedFiler:PrivateBaseUrl"] = "http://seaweed-filer:8888",
            ["SeaweedFiler:PublicBaseUrl"] = "https://media.example.test",
            ["SeaweedFiler:PathPrefix"] = "../images"
        });
        var services = new ServiceCollection();
        services.AddLogging();
        services.AddImageStorage(configuration);

        using var provider = services.BuildServiceProvider();

        Assert.Throws<OptionsValidationException>(
            () => provider.GetRequiredService<IOptions<SeaweedFilerOptions>>().Value);
    }

    private static IConfiguration BuildConfiguration(
        Dictionary<string, string?> values) =>
        new ConfigurationBuilder()
            .AddInMemoryCollection(values)
            .Build();
}
